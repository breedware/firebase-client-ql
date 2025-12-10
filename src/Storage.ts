import { 
            FirebaseStorage, 
            ref, 
            StorageReference, 
            uploadString, 
            getDownloadURL, 
            uploadBytesResumable, 
            deleteObject
        } from "firebase/storage"
import { UPLOADTYPES } from "./constants"
import { generateRandomString } from "./helpers"

export class StorageUpload {


    uploadError?: string
    // private fileUrl?: string
    file?: File | string
    private additionalPath?: string
    private maxSize?: number
    fullPath?: string
    private storage: FirebaseStorage

    
    constructor(props: {storage: FirebaseStorage, file: File | string, basePath: UPLOADTYPES, otherPath: string, maxSize?: number}){
        const {file,  basePath,  otherPath, maxSize, storage} = props
        // storage object
        this.storage =  storage;
       if(file){
        // set user additional path
        this.additionalPath = otherPath
        this.maxSize = maxSize ?? 1000000
        // set file globally
        this.file = file
         // validate file
         this.validateFile(file, basePath)
       }
    }


    // validate file (size, type)
    private validateFile = (file: File | string, storageRef: UPLOADTYPES): void =>{
        let goodSize: boolean = false
        let goodType: boolean = false
        let extension = ''
        let goodTypes: string[] = [];
        if(typeof(file)!=='string'){
            if(storageRef===UPLOADTYPES.IMAGES){
                goodTypes = ['image/png', 'image/jpg', 'image/jpeg' ];
                extension = this.getExtensionName(file.type)
            }else if(storageRef===UPLOADTYPES.DOCUMENTS){
                goodTypes = [
                    'application/pdf',
                    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    'application/vnd.ms-excel'
                ];
                extension = this.getDocExtensionName(file.type);
            }else if(storageRef===UPLOADTYPES.VIDEOS){
                goodTypes = ['video/mp4', 'video/m4v']
            } else if (storageRef===UPLOADTYPES.AUDIOS){
                goodTypes = ['audio/mp3', 'audio/mpeg']
            }
            goodType = goodTypes.includes(file.type);
            goodSize =  file.size > 0 && file.size <= this.maxSize!
        }else{
            goodType = true
            goodSize = true
        }
        
        // check and set error messages
        if(!goodSize || !goodType){
            this.setUploadError(storageRef, this.maxSize ?? 1000000, goodSize)
        }else{
            // set file name and path
            this.setFilePath(storageRef, extension)
        }
    }

    /**
     * Get human readable form for file size
     * @param size 
     * @returns 
     */
    private sizeMetric = (size: number): string =>{
        let result = `${size} bytes`
        if(size <= 999999){
            result =  `${Math.round(size/1000)} Kb`
        } else if(size <= 999999999){
            result = `${Math.round(size/1000000)} Mb`
        } else if (size <= 999999999999){
            result = `${Math.round(size/1000000000)} Gb`
        } else if (size <= 999999999999999){
            result = `${Math.round(size/1000000000000)} T`
        }
        return result;
    }

    /**
     * Get file extensions
     * @param fileType 
     * @returns 
     */
    private getExtensionName = (fileType: string): string =>{
        let ext = ''
        if(fileType==='application/pdf'){
            ext = 'pdf'
        }
        if(fileType==='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'){
            ext = '.xlsx'
        }
        if(fileType==='application/vnd.ms-excel'){
            ext = '.xls'
        }
        return ext
    }

    private getDocExtensionName = (fileType: string): string=>{
        let ext = ''
        if(fileType==='image/png'){
            ext = 'png'
        }
        if(fileType==='image/jpg'){
            ext = 'jpg'
        }
        if(fileType==='image/jpeg'){
            ext = 'jpeg'
        }
        return ext 
    }



    /**
     * setting error messages for failed file validation
     * @param ref 
     * @param maxSize 
     * @param isGoodSize 
     * @param isGoodType 
     */
    private setUploadError = (ref: UPLOADTYPES, maxSize: number, isGoodSize: boolean): void => {
        this.uploadError = !isGoodSize ? `File size is must not be larger than ${this.sizeMetric(maxSize)}` :
            `File is not a valid ${
                (ref===UPLOADTYPES.IMAGES ? "image" : (ref===UPLOADTYPES.DOCUMENTS? 'document': (
                    ref===UPLOADTYPES.VIDEOS ? 'video': 'audio'
                )))
            }`
    }

    // generate new file name and extension
    private setFilePath = (ref: UPLOADTYPES, ext?: string): void => {
        const d = new Date()
        const fileExtension:string = (ref===UPLOADTYPES.IMAGES || ref===UPLOADTYPES.DOCUMENTS)?'.'+ext:
        // (ref===UPLOADTYPES.DOCUMENTS?'.pdf':(
            ref===UPLOADTYPES.VIDEOS ? '.mp4': '.mp3'
        // ));
        const fileName = generateRandomString(30)
        this.fullPath = ref.concat(`/`,`${this.additionalPath}/`, 
            `${fileName}_${d.getTime()}${fileExtension}`)
    }

    /**
     * Upload images, documents and videos
     * @param progressMonitor 
     */
    async doUpload(): Promise<string | boolean> {
       if(this.uploadError){
            throw new Error(`doUPload Error: ,${this.uploadError}`)
       }else{
            try {
                
                const reference = ref(this.storage, this.fullPath);
                
                if(typeof(this.file)==='string'){
                    console.log("uploading as string")
                    return await this.uploadAsString(reference)
                }else{
                    console.log("uploading as file")
                    return await this.uploadAsFile(reference)
                }
            } catch (error) {
                throw new Error(`doUPload Error: ,${error}`)
            }
       }
    }

    /**
     * upload base64 data_url
     * @param reference 
     */
    private uploadAsString = async (reference: StorageReference): Promise<string | boolean>=>{
        try {
            const result = await uploadString(reference, this.file! as string, 'data_url')
            if(result){
                // get the url
                return await getDownloadURL(ref(this.storage, result.ref.fullPath))
            } else {
                return false
            }
        } catch (error) {
            throw new Error(`uploadAsString: , ${error}`)
        }
    }

    /**
     * upload blobs and files
     * @param reference 
     */
    private uploadAsFile = async (reference: StorageReference): Promise<string | boolean> =>{
        try {
            const snapShot = await uploadBytesResumable(reference, this.file! as File)
            if(snapShot){
                return await getDownloadURL(ref(this.storage, this.fullPath!))
            } else {
                return false
            }
        } catch (error) {
            throw new Error(`uploadAsFile: , ${error}`)
        }
    }

    /**
     * delete files from storage
     * @param filePath 
     * @param storage 
     * @returns {boolean}
     */
    static async deleteFile(filePath: string, storage: FirebaseStorage): Promise<boolean>{
        try {
            const delRef = ref(storage, filePath);
            // delete file
            await deleteObject(delRef);
            return true
        } catch (error) {
            return false
        }
    }
}