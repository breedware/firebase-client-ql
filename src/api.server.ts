import { Functions, httpsCallable } from "firebase/functions";
import { getSystemInfo } from "./system.info";

export interface APIReturn {
    status: 'error' | 'success',
    message: string,
    data?: any
}

interface ApiProps {
    method: string;
    data?: any;
    functionInstance: Functions;
}


export class API {

    private method;
    private data;
    private func;

    constructor ({method, data, functionInstance}: ApiProps) {
        this.method = httpsCallable(functionInstance, method);
        this.data = data;
        this.func = method;
    }

    async call():Promise<APIReturn> {
        try {
            const systemInfo = getSystemInfo();
            return (await this.method({...this.data, systemInfo})).data as APIReturn;
        } catch (error) {
            console.log(`API ${this.func} method error`, error)
            return {
                status: 'error',
                message: `Unable to complete process`
            }
        }
    }
}




