import { FirebaseApp, FirebaseError } from "@firebase/app";
import { 
    Firestore, 
    DocumentData, 
    doc, 
    collection, 
    DocumentReference, 
    CollectionReference, 
    onSnapshot, 
    where, 
    QueryConstraint, 
    QueryNonFilterConstraint,
    orderBy, 
    getDoc, 
    startAfter, 
    limit, 
    query, 
    updateDoc, 
    getDocs, 
    addDoc, 
    setDoc, 
    deleteDoc, 
    increment, 
    getCountFromServer, 
    writeBatch,
    QueryFieldFilterConstraint,
    or,
    and,
    QueryCompositeFilterConstraint,
    arrayUnion,
    arrayRemove,
    Unsubscribe,
    getFirestore,
} from "firebase/firestore";
import { Model } from "./ModelInterface";
import { andOrWhereClause, dbItems, whereClause } from "./constants";
import { API } from "./api.server";
import { errorLogger, sanitizeFirestoreData } from "./helpers";
import { getFunctions } from "firebase/functions";

export class BaseModel implements Model {

    data: any;

    private firestoreDB: Firestore;
    private table: string;
    private app: FirebaseApp;
    private functionRegion?: string;

    constructor(table: string, db: Firestore, app: FirebaseApp, functionRegion?: string) {
        if (!table) throw new Error(`[BaseModel Error]: Table name was undefined.`);
        if (!db) throw new Error(`[BaseModel Error]: Firestore instance passed to table '${table}' is undefined or invalid.`);

        this.table = table;
        this.firestoreDB = db;
        this.app = app;
        this.functionRegion = functionRegion;
    }

    // Call Cloud Functions
    async postData(formData: Record<string, any>, method: string, additionInformation?: Record<string, any>): Promise<any>{
        try {
            const server = new API({
                method, 
                data: { formData, ...additionInformation }, 
                functionInstance: getFunctions(this.app, this.functionRegion)
            });
            return await server.call();
        } catch (error) {
            errorLogger("postData: ", error);
            return false;
        }
    }

    async fetchServerTime(): Promise<number | null> {
        try {
            const server = new API({
                method: 'fetchServerTime', 
                functionInstance: getFunctions(this.app, this.functionRegion)
            });
            const response = await server.call();
            return response?.data ? (response.data as number) : null;
        } catch (error) {
            errorLogger("fetchServerTime Error: ", error);
            return null;
        }
    }

    // Save batch (Handles Firestore's 500 operation batch limit)
    async saveBatch({ data }: { data: object[] }): Promise<boolean> {
        try {
            const obj = data as dbItems[];
            const BATCH_SIZE = 500;

            for (let i = 0; i < obj.length; i += BATCH_SIZE) {
                const chunk = obj.slice(i, i + BATCH_SIZE);
                const batch = writeBatch(this.firestoreDB);

                chunk.forEach((document) => {
                    // Clone object to avoid mutating parameter state in place
                    const docData = { ...sanitizeFirestoreData(document) };
                    const ref = docData.reference;
                    delete docData.reference;

                    const docRef = ref 
                        ? doc(this.firestoreDB, this.table, ref) 
                        : doc(collection(this.firestoreDB, this.table));
                    
                    batch.set(docRef, docData);
                });

                await batch.commit();
            }
            return true;
        } catch (error) {
            errorLogger("saveBatch Error: ", error);
            throw new Error(`saveBatch failed: ${error} table: ${this.table} db: ${this.firestoreDB}`);
        }
    }

    // Update batch
    async updateBatch({ data }: { data: object[] }): Promise<boolean> {
        try {
            const obj = data as dbItems[];
            const BATCH_SIZE = 500;

            for (let i = 0; i < obj.length; i += BATCH_SIZE) {
                const chunk = obj.slice(i, i + BATCH_SIZE);
                const batch = writeBatch(this.firestoreDB);

                chunk.forEach((document) => {
                    const docData = { ...sanitizeFirestoreData(document) };
                    const ref = docData.reference;
                    
                    if (!ref) {
                        throw new Error("Missing 'reference' property for batch update item.");
                    }
                    
                    delete docData.reference;
                    const docRef = doc(this.firestoreDB, this.table, ref);
                    batch.update(docRef, docData);
                });

                await batch.commit();
            }
            return true;
        } catch (error) {
            errorLogger("updateBatch Error: ", error);
            throw new Error(`updateBatch failed: ${error} table: ${this.table} db: ${this.firestoreDB}`);
        }
    }

    // Delete batch
    async deleteBatch({ ids }: { ids: string[] }): Promise<boolean> {
        try {
            const BATCH_SIZE = 500;

            for (let i = 0; i < ids.length; i += BATCH_SIZE) {
                const chunk = ids.slice(i, i + BATCH_SIZE);
                const batch = writeBatch(this.firestoreDB);

                chunk.forEach((id) => {
                    const docRef = doc(this.firestoreDB, this.table, id);
                    batch.delete(docRef);
                });

                await batch.commit();
            }
            return true;
        } catch (error) {
            errorLogger("deleteBatch Error: ", error);
            throw new Error(`deleteBatch failed: ${error} table: ${this.table} db: ${this.firestoreDB}`);
        }
    }

    /**
     * Get realtime update from the database.
     * RETURNS Unsubscribe handle to prevent memory leaks!
     */
    stream(callBack: (data: DocumentData | DocumentData[] | undefined) => void, id?: string): Unsubscribe { 
        if (id) {
            const ref = doc(this.firestoreDB, this.table, id);
            return onSnapshot(ref, 
                (docSnap) => {
                    callBack(docSnap.exists() ? { ...docSnap.data(), reference: docSnap.id } : undefined);
                },
                (error) => {
                    errorLogger("stream Error: ", error);
                    callBack(undefined);
                }
            );
        } else {
            const ref = collection(this.firestoreDB, this.table);
            return onSnapshot(ref, 
                (snapShot) => {
                    callBack(snapShot.docs.map((docItem) => ({ ...docItem.data(), reference: docItem.id })));
                },
                (error) => {
                    errorLogger("stream Error: ", error);
                    callBack(undefined);
                }
            );
        }
    }

    /**
     * Get realtime values from database with where clause.
     * RETURNS Unsubscribe handle to prevent memory leaks!
     */
    async streamWhere(
        wh: whereClause[], 
        callBack: (data: DocumentData[]) => void, 
        lim?: number, 
        order?: { parameter: string; direction?: 'asc' | 'desc' }, 
        offset?: string
    ): Promise<Unsubscribe> {
        try {
            const constraints: QueryConstraint[] = wh.map(clause => where(clause.key, clause.operator, clause.value));
            
            if (order) {
                constraints.push(orderBy(order.parameter, order.direction));
            }
            if (offset) {
                const offDoc = await getDoc(doc(this.firestoreDB, this.table, offset));
                if (offDoc.exists()) {
                    constraints.push(startAfter(offDoc));
                }
            }
            if (lim) {
                constraints.push(limit(lim));
            }

            const ref = collection(this.firestoreDB, this.table);
            
            return onSnapshot(
                query(ref, ...constraints), 
                (snapShot) => {
                    callBack(snapShot.docs.map((item) => ({ ...item.data(), reference: item.id })));
                },
                (error) => {
                    errorLogger("streamWhere listener error: ", error);
                    callBack([]);
                }
            );
        } catch (error) {
            errorLogger("streamWhere execution error: ", error);
            throw new Error(`streamWhere failed: ${error} table: ${this.table} db: ${this.firestoreDB}`);
        }
    }

    async find(id: string): Promise<boolean> {
        try {
            const ref = doc(this.firestoreDB, this.table, id);
            const docSnap = await getDoc(ref);
            if (docSnap.exists()) {
                this.data = { ...docSnap.data(), reference: id };
                return true;
            } 
            this.data = null;
            return false;
        } catch (error) {
            errorLogger("find Error: ", error);
            throw new Error(`find failed: ${error} table: ${this.table} db: ${this.firestoreDB}`);
        }
    }

    async dataExists(id: string): Promise<boolean> {
        try {
            const ref = doc(this.firestoreDB, this.table, id);
            const docSnap = await getDoc(ref);
            return docSnap.exists();
        } catch (error) {
            errorLogger("dataExists Error: ", error);
            throw new Error(`dataExists failed: ${error} table: ${this.table} db: ${this.firestoreDB}`);
        }
    }

    async update(data: any, id: string): Promise<boolean> {
        try {
            const updatePayload = { ...sanitizeFirestoreData(data) };
            delete updatePayload.reference;

            const docRef = doc(this.firestoreDB, this.table, id);
            await updateDoc(docRef, updatePayload);
            return true;
        } catch (error) {
            errorLogger("update Error: ", error);
            throw new Error(`update failed: ${error} table: ${this.table} db: ${this.firestoreDB}`);
        }
    }

    async updateAtomicArray(data: any[], id: string, key: string): Promise<boolean> {
        try {
            const docRef = doc(this.firestoreDB, this.table, id);
            await updateDoc(docRef, { [key]: arrayUnion(...data) });
            return true;
        } catch (error) {
            errorLogger("updateAtomicArray Error: ", error);
            throw new Error(`updateAtomicArray failed: ${error} table: ${this.table} db: ${this.firestoreDB}`);
        }
    }

    async removeFromArray(data: any[], id: string, key: string): Promise<boolean> {
        try {
            const docRef = doc(this.firestoreDB, this.table, id);
            await updateDoc(docRef, { [key]: arrayRemove(...data) });
            return true;
        } catch (error) {
            errorLogger("removeFromArray Error: ", error);
            throw new Error(`removeFromArray failed: ${error} table: ${this.table} db: ${this.firestoreDB}`);
        }
    }

    async findAll(ids?: string[]): Promise<boolean> {
        try {
            if (ids && ids.length > 0) {
                const results: DocumentData[] = [];
                for (const id of ids) {
                    const found = await this.find(id);
                    if (found && this.data) {
                        results.push(this.data as DocumentData);
                    }
                }
                this.data = results;
                return results.length > 0;
            } else {
                const colRef = collection(this.firestoreDB, this.table);
                const snapshots = await getDocs(colRef);
                if (!snapshots.empty) {
                    this.data = snapshots.docs.map((docItem) => ({ ...docItem.data(), reference: docItem.id }));
                    return true;
                } else {
                    this.data = [];
                    return false;
                }
            }
        } catch (error) {
            errorLogger("findAll Error: ", error);
            throw new Error(`findAll failed: ${error} table: ${this.table} db: ${this.firestoreDB}`);
        }
    }

    async findWhereOrAnd({ wh, lim, order, offset }: {
        wh?: {
            type: 'or' | 'and' | 'andOr';
            parameter: andOrWhereClause[];
        }; 
        lim?: number; 
        order?: {
            parameter: string;
            direction?: 'asc' | 'desc';
        }; 
        offset?: string;
    }): Promise<boolean> {
        try {
            const colRef = collection(this.firestoreDB, this.table);
            const andWhere: QueryFieldFilterConstraint[] = [];
            const orWhere: QueryFieldFilterConstraint[] = [];
            let filterConstraint: QueryCompositeFilterConstraint | null = null;

            if (wh && wh.parameter.length > 0) {
                wh.parameter.forEach((clause) => {
                    const whe = where(clause.key, clause.operator, clause.value);
                    clause.type === 'and' ? andWhere.push(whe) : orWhere.push(whe);
                });

                if (wh.type === 'andOr' && andWhere.length > 0 && orWhere.length > 0) {
                    filterConstraint = and(...andWhere, or(...orWhere));
                } else if (wh.type === 'or' && orWhere.length > 0) {
                    filterConstraint = or(...orWhere);
                } else if (andWhere.length > 0) {
                    filterConstraint = and(...andWhere);
                }
            }        

            const nonFilterConstraints: QueryNonFilterConstraint[] = [];
            if (order) nonFilterConstraints.push(orderBy(order.parameter, order.direction));
            
            if (offset) {
                const offDoc = await getDoc(doc(this.firestoreDB, this.table, offset));
                if (offDoc.exists()) {
                    nonFilterConstraints.push(startAfter(offDoc));
                }
            }
            if (lim) nonFilterConstraints.push(limit(lim));

            const q = filterConstraint 
                ? query(colRef, filterConstraint, ...nonFilterConstraints)
                : query(colRef, ...nonFilterConstraints);

            const snapshot = await getDocs(q);
            if (!snapshot.empty) {
                this.data = snapshot.docs.map((docItem) => ({ ...docItem.data(), reference: docItem.id }));
                return true;
            } else {
                this.data = [];
                return false;
            }
        } catch (error) {
            errorLogger("findWhereOrAnd Error: ", error);
            throw new Error(`findWhereOrAnd failed: ${error} table: ${this.table} db: ${this.firestoreDB}`);
        }
    }

    async findWhere({ wh, lim, order, offset }: {
        wh?: whereClause[]; 
        lim?: number; 
        order?: {
            parameter: string;
            direction?: 'asc' | 'desc';
        }; 
        offset?: string;
    }): Promise<DocumentData[]> {
        try {
            const constraints: QueryConstraint[] = wh ? wh.map(clause => where(clause.key, clause.operator, clause.value)) : [];

            if (order) constraints.push(orderBy(order.parameter, order.direction));
            if (offset) {
                const offDoc = await getDoc(doc(this.firestoreDB, this.table, offset));
                if (offDoc.exists()) {
                    constraints.push(startAfter(offDoc));
                }
            }
            if (lim) constraints.push(limit(lim));

            const ref = collection(this.firestoreDB, this.table);
            const snapshot = await getDocs(query(ref, ...constraints));

            if (!snapshot.empty) {
                return snapshot.docs.map((docItem) => ({ ...docItem.data(), reference: docItem.id }));
            }
            return [];
        } catch (error) {
            errorLogger("findWhere Error: ", error);
            throw new Error(`findWhere failed: ${error} table: ${this.table} db: ${this.firestoreDB}`);
        }
    }

    async save(data: any, id?: string): Promise<string | boolean> {
        try {
            const payload = { ...sanitizeFirestoreData(data) };
            delete payload.reference;

            if (id === undefined) {
                const documentRef = await addDoc(collection(this.firestoreDB, this.table), payload);
                return documentRef.id;
            } else {
                await setDoc(doc(this.firestoreDB, this.table, id), payload);
                return id;
            }
        } catch (error) {
            errorLogger("save Error: ", error);
            throw new Error(`save failed: ${error} table: ${this.table} db: ${this.firestoreDB}`);
        }
    }

    async delete(id: string): Promise<boolean> {
        try {
            await deleteDoc(doc(this.firestoreDB, this.table, id));
            return true;
        } catch (error) {
            errorLogger("delete Error: ", error);
            throw new Error(`delete failed: ${error} table: ${this.table} db: ${this.firestoreDB}`);
        }
    }

    async incrementDecrement({ dbReference, key, isIncrement = true, incrementalValue }: {
        dbReference: string; 
        key: string; 
        isIncrement?: boolean; 
        incrementalValue?: number;
    }): Promise<boolean> {
        try {
            const docRef = doc(this.firestoreDB, this.table, dbReference);
            const amount = incrementalValue ?? 1;
            const value = isIncrement ? amount : -amount;

            await updateDoc(docRef, { [key]: increment(value) });
            return true;
        } catch (error) {
            errorLogger("incrementDecrement Error: ", error);
            throw new Error(`incrementDecrement failed: ${error} table: ${this.table} db: ${this.firestoreDB}`);
        }
    }

    async countData(wh?: whereClause[]): Promise<number> {
        try {
            const qryParameter = wh ? wh.map(clause => where(clause.key, clause.operator, clause.value)) : [];
            const colRef = collection(this.firestoreDB, this.table);

            const qry = qryParameter.length > 0 ? query(colRef, ...qryParameter) : colRef;
            const aggregate = await getCountFromServer(qry);

            return aggregate.data().count;
        } catch (error) {
            errorLogger("countData Error: ", error);
            throw new Error(`countData failed: ${error} table: ${this.table} db: ${this.firestoreDB}`);
        }
    }

    async streamCount(
        wh: whereClause[],
        callBack: (data: number) => void,
        order?: { parameter: string; direction?: 'asc' | 'desc' },
        offset?: string
    ): Promise<Unsubscribe> {
        try {
            const constraints: QueryConstraint[] = wh.map(clause => where(clause.key, clause.operator, clause.value));

            if (order) constraints.push(orderBy(order.parameter, order.direction));
            if (offset) {
                const offDoc = await getDoc(doc(this.firestoreDB, this.table, offset));
                if (offDoc.exists()) {
                    constraints.push(startAfter(offDoc));
                }
            }

            const streamerConstraint = [...constraints, limit(1)];
            const ref = collection(this.firestoreDB, this.table);

            return onSnapshot(
                query(ref, ...streamerConstraint),
                async () => {
                    const aggregate = await getCountFromServer(query(ref, ...constraints));
                    callBack(aggregate.data().count);
                },
                (error) => {
                    errorLogger("streamCount listener error: ", error);
                }
            );
        } catch (error) {
            errorLogger("streamCount Error: ", error);
            throw new Error(`streamCount failed: ${error} table: ${this.table} db: ${this.firestoreDB}`);
        }
    }
}