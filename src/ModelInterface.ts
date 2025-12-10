import { DocumentData } from "firebase/firestore"
import { whereClause } from "./constants"

export interface Model {
 
    data: object;
    // fetch single item
    find(id: string): Promise<boolean>

    // select all from database
    findAll(ids?: string[]): Promise<boolean>

    // find item by where clause
    findWhereOrAnd({wh, lim, order, offset} : 
        {
            wh?:  {
                type: 'or' | 'and' | 'andOr',
                parameter: whereClause[]
            }, 
            lim?:number, 
            order?:{
                parameter: string,
                direction?: 'asc' | 'desc'
            },
            offset?: string
        }): Promise<boolean>
    

    findWhere({wh, lim, order, offset} : 
        {
            wh?:  whereClause[], 
            lim?:number, 
            order?:{
                parameter: string,
                direction?: 'asc' | 'desc'
            },
            offset?: string
        }): Promise<DocumentData[]>

    /**
     * Save data to database,
     * create new data if does not exists
     * and update data if already exists
     */
    save(data: object, id?: string ):  Promise<string | boolean>

    /**
     * Delete an item from database
     */
    delete(id: string): Promise<boolean>

    /**
     * Update part of data
     * @param data 
     */
    update(data: object, id:string): Promise<boolean>

    /**
     * Realtime data listener
     * @param where 
     */
    stream(callBack: (data: DocumentData | DocumentData[]| undefined)=>void, id?: string, ):  void

    /**
     * Stream data with where clause
     * @param wh 
     * @param callBack 
     * @param errorHander 
     * @param lim 
     * @param order 
     */
    streamWhere(wh: whereClause[], callBack: (data: DocumentData[])=>void,  lim?:number, order?: {
        parameter: string,
        direction?: 'asc' | 'desc'
    }, offset?: string): void 

    /**
     * count data in database
     * @param qyery 
     * @param isAll 
     */
    countData(where: whereClause[]): Promise<number>


    /**
     * create multiple documents
     * @param param0 
     */
    saveBatch({data}:{data: object[]}): Promise<boolean>

    /**
     * Update multiple documents
     * @param param0 
     */
    updateBatch({data}:{data: object[], callBack:()=>void }): Promise<boolean>

    /**
     * Delete multiple documents
     * @param param0 
     */
    deleteBatch({ids}:{ids: string[]}): Promise<boolean>

    incrementDecrement({dbReference, key, isIncrement, incrementalValue}: 
        {dbReference: string, key:string, isIncrement?:boolean, incrementalValue?: number} ): Promise<boolean>
}