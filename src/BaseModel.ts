import { FirebaseApp } from "@firebase/app";
import { Firestore, 
    DocumentData, doc, 
    collection, DocumentReference, 
    CollectionReference, onSnapshot, where, 
    QueryConstraint, orderBy, getDoc, startAfter, 
    limit, query, updateDoc, getDocs, addDoc, 
    setDoc, deleteDoc, increment, getCountFromServer, 
    writeBatch,
    QueryFieldFilterConstraint,
    or,
    and,
    QueryCompositeFilterConstraint,
    arrayUnion,
    arrayRemove,
    getFirestore
} from "firebase/firestore";
import { Model } from "./ModelInterface";
import { andOrWhereClause, dbItems, whereClause } from "./constants";
import { API } from "./api.server";
import { errorLogger } from "./helpers";

export class BaseModel implements Model {

    // current data returned from firestore
    data: any;

    private firestorDB?: Firestore
    // Get a new write batch
    // protected batch?: WriteBatch

    // Database table name
    private table: string = '';
    private app: FirebaseApp;

    // offset data
    // offset?: QueryDocumentSnapshot<DocumentData>;

    constructor(table: string, app: FirebaseApp){
        this.table = table
        this.firestorDB = getFirestore(app);
        this.app = app;
    }

    // call cloud functions
    async postData(formData: Record<string, any>, method: string, additionInformation?: any): Promise<any>{
        try {
            const server = new API({method, data: {formData, additionInformation}, app: this.app});
            return await server.call();
        } catch (error) {
            errorLogger("postData: ", error);
            return false;
        }
    }

    /**
     * Fetch current server time from your backend API
     * @returns number (timestamp) | null
     */
    async fetchServerTime(): Promise<number | null> {
        try {
            const server = new API({method: 'fetchServerTime', app: this.app});
            const response = await server.call();

            if (response?.data) {
                return response.data as number;
            }

            return null;
        } catch (error) {
            errorLogger("fetchServerTime Error: ", error);
            return null;
        }
    }


    /**
     * save multiple documents
     * @param param0 
     */
    async saveBatch ({ data }: { data: object[]}): Promise<boolean> {
        try {
            const batch = writeBatch(this.firestorDB!)
            const obj = data as dbItems[]
            obj.forEach((document)=>{
                const docRef = document.reference? 
                doc(this.firestorDB!, this.table, document.reference): 
                doc(collection(this.firestorDB!, this.table))
                if(document.reference){
                    delete document.reference
                }
                
                batch.set(docRef, document)
            })
            await batch.commit()
            return true
        } catch (error) {
            throw new Error(`saveBatch: , ${error}`)
        }
    }

    /**
     * update multiple documents
     * @param param0 
     */
    async updateBatch({ data }: { data: object[] }): Promise<boolean> {
        try {
            const batch = writeBatch(this.firestorDB!)
            const obj = data as dbItems[]
            obj.forEach((document)=>{
                const docRef = doc(this.firestorDB!, this.table, document.reference!)
                delete document.reference
                batch.update(docRef, document as object)
            })
            await batch.commit()
            return true
        } catch (error) {
            throw new Error(`updateBatch: , ${error}`)
        }
    }

    /**
     * delete multiple documents
     * @param param0 
     */
    async deleteBatch({ ids }: { ids: string[]  }): Promise<boolean> {
        try {
            const batch = writeBatch(this.firestorDB!)
            ids.forEach((id)=>{
                const docRef = doc(this.firestorDB!, this.table, id)
                batch.delete(docRef)
            })
            await batch.commit()
            return true
        } catch (error) {
            throw new Error(`deleteBatch: , ${error}`)
        }
    }



    /**
     * Get realtime update from the database
     * @param id 
     */
    stream(callBack: (data:  DocumentData | DocumentData[] | undefined)=>void, id?: string ): void { 
    
        const ref:DocumentReference<DocumentData> | CollectionReference<DocumentData> = id? 
            doc(this.firestorDB!, this.table, id):
            collection(this.firestorDB!, this.table)
        try {
            if(id){
                onSnapshot(ref as DocumentReference, (doc) => {
                    callBack(doc.exists() ? {...doc.data(), reference: ref.id}: undefined)
                })
            }else{
                onSnapshot(ref as CollectionReference, (snapShot) => {
                    callBack(
                        snapShot.docs.map((value)=>{
                            const data = {...value.data(), reference: value.id}
                            return data
                        })
                    )
                })
            }
        } catch (error) {
            callBack(undefined)
        }
    }

    /**
     * Get realtime value from database with where clause
     * @param wh 
     * @param lim 
     * @param order 
     */
    async streamWhere(wh: whereClause[], callBack: (data: DocumentData[])=>void,  lim?:number, order?: {
        parameter: string,
        direction?: 'asc' | 'desc'
    }, offset?: string): Promise<void> {
        try {
            const whereParameter = wh.map(clause=> where(
                clause.key, 
                clause.operator, 
                clause.value))
            let constraint: QueryConstraint[] = []
            // add where parameter
            if(wh){
                constraint.push(...whereParameter)
            }
            // add order by
            if(order){
                constraint.push(orderBy(order.parameter, order.direction))
            }
            // add offset
            if(offset){
                const off  =  await getDoc(doc(this.firestorDB!, this.table, offset));
                constraint.push(startAfter(off))
            }
            // add limit
            if(lim){
                // 
                constraint.push(limit(lim))
            }
            const ref: CollectionReference<DocumentData> = collection(this.firestorDB!, this.table, )
        
            onSnapshot(query(
                ref,  
                ...constraint
            ), (snapShot) => {
                callBack(snapShot.docs.map((value)=>{
                    const data = {...value.data(), reference: value.id}
                    return data
                }))
            })
        } catch (error) {
            throw new Error(`streamWhere: , ${error}`)
        }
    }

    /**
     * Fetch a single item from database
     * @param id 
     */
    async find(id: string ): Promise< boolean> {
        try {
            const ref = doc(this.firestorDB!, this.table, id)
            const docSnap = await getDoc(ref)
            if (docSnap.exists()) {
                this.data = {...docSnap.data(), reference: id};
                return true;
            } 
            return false
        } catch (error) {
            throw new Error(`find: , ${error}`)
        }
    }

    /**
     * check if data exists
     * @param id 
     * @returns 
     */
    async dataExists(id: string): Promise<boolean> {
        try {
            const ref = doc(this.firestorDB!, this.table, id);
            const docSanp = await getDoc(ref);
            return docSanp.exists()
        } catch (error) {
            throw new Error(`dataExists: , ${error}`)
        }
    }

    /**
     * Update part of a data
     * @param data 
     * @param id 
     * @returns 
     */
    async update(data: any, id: string): Promise<boolean> {
        try {
            delete data.reference
            const docRef = doc(this.firestorDB!, this.table, id)
            await updateDoc(docRef, data)
            return true
        } catch (error) {
            throw new Error(`update: , ${error}`)
        }
    }

    /**
     * update an array in a document
     * @param {Array<any>} data array of data to be saved
     * @param {string} id document reference
     * @param {string} key key to reference
     * @returns {boolean}
     */
    async updateAtomicArray(data: any[], id: string, key: string): Promise<boolean> {
        try {
            const docRef = doc(this.firestorDB!, this.table, id);
            await updateDoc(docRef, {[key]: arrayUnion(...data)});
            return true;
        } catch (error) {
            throw new Error(`updateAtomicArray error: ${error}`);
        }
    }

    /**
     * removes items from document array
     * @param {Array<any>} data array of data to be removed
     * @param {string} id document reference
     * @param {string} key key to reference
     * @returns {boolean}
     */
    async removeFromArray(data: any[], id: string, key: string): Promise<boolean> {
        try {
            const docRef = doc(this.firestorDB!, this.table, id);
            await updateDoc(docRef, {[key]: arrayRemove(...data)});
            return true;
        } catch (error) {
            throw new Error(`updateAtomicArray error: ${error}`);
        }
    }

    /**
     * Get all items from database
     * @returns void
     */
    async findAll(ids?: string[]) : Promise<boolean> {
        try {
            const colRef = collection(this.firestorDB!, this.table)
            if(ids){
                const results: DocumentData[] = []
                for (let id of ids){
                    const found = await this.find(id)
                    if(found){
                        results.push(this.data as DocumentData)
                    }
                }
                this.data = results;
                return true
            } else {
                const snaptshots =  await getDocs(colRef)
                if(!snaptshots.empty){
                    this.data =  snaptshots.docs.map((document)=>{
                        return {...document.data(), reference: document.id}
                    })
                    return true;
                }else{
                    return false;
                }
            }
            
        } catch (error) {
            throw new Error(`findAll: , ${error}`)
        }
    }

    /**
     * perform complex query
     * @param param0 
     */
    async findWhereOrAnd( {wh, lim, order, offset}:  {
        wh?: {
            type: 'or'| 'and' | 'andOr',
            parameter: andOrWhereClause[]
        }, 
        lim?:number, 
        order?:{
            parameter: string,
            direction?: 'asc' | 'desc'
        }, 
        offset?: string
    }): Promise<boolean> {
        try {
            // get Collection reference
            const colRef = collection(this.firestorDB!, this.table)
            // set where clause
            const andWhere: QueryFieldFilterConstraint[] = [];
            const orWhere: QueryFieldFilterConstraint[] = [];
            let filterConstraint: QueryCompositeFilterConstraint = and();

            // add where parameter
            if(wh){
                wh.parameter.forEach((clause)=>{
                    const whe = where(
                        clause.key, 
                        clause.operator, 
                        clause.value
                    )
                    clause.type === 'and' ?
                    andWhere.push(whe) : orWhere.push(whe)
                })

                if(wh.type==='andOr'){
                    filterConstraint = and(...andWhere, or(...orWhere))
                } else if(wh.type === 'or') {
                    filterConstraint = or(...orWhere)
                } else {
                    filterConstraint = and(...andWhere)
                }
            }        
            let constraint = []
            // add order by
            if(order){
                constraint.push(orderBy(order.parameter, order.direction))
            }
            // add offset
            if(offset){
                const off  =  await getDoc(doc(this.firestorDB!, this.table, offset));
                constraint.push(startAfter(off))
            }
            // add limit
            if(lim){
                constraint.push(limit(lim))
            }
            // fetch data
        
            const snapshot = await getDocs(
                query(
                    colRef,
                    filterConstraint,
                    ...constraint
                )
            )
            if(!snapshot.empty){
                this.data = snapshot.docs.map(document=>{
                    return {...document.data(), reference: document.id}
                });
                return true;
            }else{ return false }
            
        } catch (error) {
            throw new Error(`findWhereOrAnd: ${error}`)
        }
    }

    /**
     * complex query with and only
     * @param param0 
     * @returns 
     */
    async findWhere({wh, lim, order, offset} : {
        wh?: whereClause[], lim?:number, order?: {
            parameter: string,
            direction?: 'asc' | 'desc'
        }, offset?: string
    }): Promise<DocumentData[]> {
        try {
            const whereParameter = wh? wh.map(clause=> where(
                clause.key, 
                clause.operator, 
                clause.value)) : []
            let constraint: QueryConstraint[] = []
            // add where parameter
            if(wh){
                constraint.push(...whereParameter)
            }
            // add order by
            if(order){
                constraint.push(orderBy(order.parameter, order.direction))
            }
            // add offset
            if(offset){
                const off  =  await getDoc(doc(this.firestorDB!, this.table, offset));
                constraint.push(startAfter(off))
            }
            // add limit
            if(lim){
                // 
                constraint.push(limit(lim))
            }
            const ref: CollectionReference<DocumentData> = collection(this.firestorDB!, this.table, )
        
            const snapshot = await getDocs(
                query(
                    ref,
                    ...constraint
                )
            )
            if(!snapshot.empty){
                return snapshot.docs.map(document=>{
                    return {...document.data(), reference: document.id}
                })
            }else{ return [] }
            
        } catch (error) {
            throw new Error(`findWhere: , ${error}`)
        }
    }

    /**
     * create or update data
     * @param data 
     */
    async save(data: any, id?: string | undefined): Promise<string | boolean> {
        delete data.reference
        try {
            if(id===undefined){
                const documentRef = await addDoc(collection(this.firestorDB!, this.table), data)
                return documentRef.id
            } else {
                await setDoc(doc(this.firestorDB!, this.table, id!), data)
                return id!
            }
                    
        } catch (error) {
            throw new Error(`save error: , ${error}`)
        }
    }

    /**
     * Delete document from database
     * @param id 
     */
    async delete(id: string): Promise<boolean> {
        try {
            await deleteDoc(doc(this.firestorDB!, this.table, id))
            return true
        } catch (error) {
            throw new Error(`delete: , ${error}`)
        }
    }

    /**
     * Increment or decrement counters
     * @param param0 
     */
    async incrementDecrement({dbReference, key, isIncrement = true, incrementalValue}: 
        {dbReference: string, key:string, isIncrement?:boolean, incrementalValue?: number}): Promise<boolean>{
        
            try {
                const docRef = doc(this.firestorDB!, this.table, dbReference)
                const value = isIncrement?incrementalValue??1:(incrementalValue??1) * -1
                await updateDoc(docRef, {[key]: increment(value)})
                return true
            } catch (error) {
                throw new Error(`incrementDecrement: , ${error}`)
            }
    }

    /**
     * Count data in database
     * @param {whereClause[]} wh - query parameter (e.g. [
     * {
     */
    async countData(wh: whereClause[]): Promise<number> {
        try {
            
        // set parameter
        const qryParameter = wh.map(clause=> where(
            clause.key, 
            clause.operator, 
            clause.value))

        const qry = query(
            collection(this.firestorDB!, this.table),  
            ...qryParameter
        )
        const aggregate = await getCountFromServer(qry)
        return aggregate.data().count
        } catch (error) {
            throw new Error(`countData error: ,${error}`)
        }
    }

    /**
     * Get realtime value from database with where clause
     * @param wh 
     * @param lim 
     * @param order 
     */
    async streamCount(
        wh: whereClause[],
        callBack: (data: number) => void,
        order?: { parameter: string; direction?: 'asc' | 'desc' },
        offset?: string
        ): Promise<() => void> {
        try {
            const whereParameter = wh.map(clause =>
            where(clause.key, clause.operator, clause.value)
            );

            const constraint: QueryConstraint[] = [...whereParameter];

            if (order) constraint.push(orderBy(order.parameter, order.direction));
            if (offset) {
            const off = await getDoc(doc(this.firestorDB!, this.table, offset));
                constraint.push(startAfter(off));
            }

            const streamerConstraint = [...constraint, limit(1)];
            const ref: CollectionReference<DocumentData> = collection(this.firestorDB!, this.table);

            const unsubscribe = onSnapshot(
            query(ref, ...streamerConstraint),
            async (snapShot) => {
                if (snapShot.empty) return;
                const aggregate = await getCountFromServer(query(
                collection(this.firestorDB!, this.table),
                ...constraint
                ));
                callBack(aggregate.data().count);
            }
            );

            return unsubscribe;

        } catch (error) {
            throw new Error(`streamCount: ${error}`);
        }
    }

}