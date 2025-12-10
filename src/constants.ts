import { MultiFactorResolver, User } from "firebase/auth"
import { WhereFilterOp } from "firebase/firestore"

// firebase storage test
export const fbsession = /^firebase:authUser:/

/**
 * firebase where clause
 */
export type whereClause = {
    key: string,
    operator: WhereFilterOp,
    value: any,
}

/**
 * firebase where clause
 */
export type andOrWhereClause = {
    key: string,
    operator: WhereFilterOp,
    value: any,
    type: 'and' | 'or'
}

export enum UPLOADTYPES {
    IMAGES = 'images',
    DOCUMENTS = 'documents',
    VIDEOS = 'videos',
    AUDIOS = 'audios'
}


export type dbItems = {
    reference?: string,
}

export type FunctionReturn = {
    data: any
}

export enum AUTH_PROVIDERS {
    GOOGLE,
    APPLE,
    FACEBOOK,
    TWITTER
}

export type QueryReturn = {
    data?: any,
    status: 'error' | 'success',
    message: string
}

export type MFAVerifier = {
    verificationId: string,
    user?: User,
    resolver?: MultiFactorResolver
}
