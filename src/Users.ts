import { 
        Auth, 
        setPersistence, 
        browserSessionPersistence, 
        signInWithEmailAndPassword, 
        signInWithPhoneNumber,  
        ApplicationVerifier, 
        updatePassword, 
        sendPasswordResetEmail, 
        signOut, 
        ConfirmationResult, 
        getMultiFactorResolver, 
        User, 
        multiFactor, 
        PhoneAuthProvider, 
        MultiFactorResolver, 
        PhoneMultiFactorGenerator, 
        createUserWithEmailAndPassword, 
        sendEmailVerification, 
        applyActionCode, 
        verifyPasswordResetCode, 
        deleteUser,
        browserLocalPersistence,
        confirmPasswordReset,
        ActionCodeSettings,
} from 'firebase/auth'
import { BaseModel } from './BaseModel'
import { MFAVerifier, QueryReturn, dbItems } from './constants'
// import { throw new Error } from './helpers'

export class Users extends BaseModel {

    private user?: User


    /**
     * register user and send email verification
     * delete user if registration is not successful
     * @param param0 
     */
    async registerWithEmailAndPassword ({
        auth, 
        email, 
        password, 
        userData, 
        persist = 'session',
        
     }: {
        auth: Auth, 
        email:string, 
        password: string, 
        userData?: dbItems, 
        persist?: 'local' | 'session',
    }): Promise<string | null> {
        try {
            if(persist){
                await setPersistence(auth, persist==='local'? browserLocalPersistence:browserSessionPersistence)
            }
            // create firebase user with email and password
            const credential = await createUserWithEmailAndPassword(auth, email, password)
            this.user = credential.user
            
            // create firestore document
            if(userData){
                await this.save(userData, credential.user.uid)
            }
            return credential.user.uid
        } catch (error) {
            // delete account
            if(this.user){
                this.deleteAccount(this.user)
            }
            throw new Error(`registerWithEmailAndPassword error: , ${error}`)
        }
    }

     /**
     * confirm user is valid and get their information
     * from firestore users table if exists
     * @param { string , string, boolean} credentials - login credentials 
     * @returns {Promise<QueryReturn>}
     */
     async login ({email, password, auth, persist = 'session', verifyEmail = false}: 
        {email: string, password: string, auth: Auth,  persist?: 'session' | 'local', verifyEmail?: boolean}): Promise<QueryReturn> {
        
        try {
            // persist user in session
            if(persist){
                await setPersistence(auth, persist==='local'? browserLocalPersistence:browserSessionPersistence)
            }
            // verify user's email and password is correct
            const userAuth = await signInWithEmailAndPassword(auth, email, password)
            if(userAuth){
                if(verifyEmail && !userAuth.user.emailVerified){
                    // await this.sendEmailVerification(userAuth.user)
                    return {message: "Email is not verified", status: 'error'}
                } else {
                    return {message: "User successfully logged in", status: 'success', data: userAuth.user}
                }
            } else {
                return {message: "Unknown account", status: 'error'}
            }
        } catch (error) {
            throw new Error(`login error: , ${error}`);
        }

    }

    /**
     * sign user with user's number
     * @param param0 
     * @returns 
     */
    async signInWithPhoneNumber({auth, phoneNumber, appVerifier}: {auth: Auth, phoneNumber: string, appVerifier: ApplicationVerifier}): Promise<ConfirmationResult | boolean> {
        try {
            // persist user in session
            return await signInWithPhoneNumber(auth, phoneNumber, appVerifier)
        } catch (error) {
            throw new Error(`signInWithPhoneNumber error: , ${error}`);
        }
    }


    /**
     * Check if user is currently logged in
     * @param auth 
     * @returns 
     */

    isLoggedIn(auth: Auth): boolean {
        try {
            if(auth.currentUser){
                return true
            } else {
                return false
            }
        } catch (error) {
            throw new Error(`isLoggedIn error: , ${error}`)
        }
    }

    /**
     * Reset logged in user's password
     * @param {Auth, string} param0 
     * @returns {boolean}
     */
    async resetPassword({auth, newPassword}: {auth: Auth, newPassword: string}): Promise<boolean>{
        try {
            await updatePassword(auth.currentUser!, newPassword)
            return true
        } catch (e) {
            throw new Error(`resetPassword error: , ${e}`)
        }
    }

    /**
     * send password reset message to user's email address
     * @param param0 
     * @returns 
     */
    async sendPasswordResetMessage({auth, email} : {auth: Auth, email: string}): Promise<boolean>{
        try {
            await sendPasswordResetEmail(auth, email)
            return true
        } catch (e) {
            throw new Error(`sendPasswordResetMessage error: , ${e}`)
        }
    }

    /**
     * logout users and end current session
     * @param param0 
     * @returns 
     */
    async logout({auth}: {auth: Auth}): Promise<boolean>{
        try {
            await signOut(auth)
            return true
        } catch (e) {
            throw new Error(`logout error: , ${e}`)
        }
    }

     /**
    * create and validate users
    * @param param0 
    */
   async loginWithMultiAuthFactor({email, password, auth, recaptcha, getNumber, persist = true, verifyEmail = false}: 
    {email: string, password: string, auth: Auth, recaptcha: ApplicationVerifier, getNumber?:boolean, persist?: boolean, verifyEmail?: boolean}): Promise<MFAVerifier | null>{
        
        try {
            // persist user in session
            if(persist){
                await setPersistence(auth, browserSessionPersistence)
            }
            // sign in user
            const credential = await signInWithEmailAndPassword(auth, email, password)
            if(credential){
                // user is required to verify their email address
                if(verifyEmail && !credential.user.emailVerified){
                    await this.sendEmailVerification(credential.user)
                    throw new Error("Email is not verified")
                }

                let phoneNumber
                if(getNumber){
                    phoneNumber = await this.getPhoneNumber(credential.user.uid)
                }
                // user is not MFA enabled
                // enroll user with multi-factor auth if user is admin
                const user = credential.user
                const verificationId = await this.setMultiFactorEnrollment(user, recaptcha, auth, phoneNumber ?? credential.user.phoneNumber!)
                if(verificationId){
                    return {verificationId, user}
                } else {
                    // unable to send message
                    return null
                }
            } else {
                // user does not exist
                return null
            }            
        } catch (e) {
            const error = e as any
            if (error.code === 'auth/multi-factor-auth-required') {
                // The user is a multi-factor user. Second factor challenge is required.
                const resolver = getMultiFactorResolver(auth, error);
                return await this.sendOTP(resolver, recaptcha, auth)
            } else {
                throw new Error(`loginWithMultiAuthFactor error: ${error}`)
            }
        }
   }

   /**
    * fetch phone number from database
    * @param uid 
    * @returns 
    */
   private getPhoneNumber = async (uid: string): Promise<string | null>=>{
        let phoneNumber = null
        const dbUser = await this.find(uid)
        if(dbUser){
            const dUser = this.data
            phoneNumber = dUser.phoneNumber
        }
        return phoneNumber
   }

    /**
     * send OTP to enable 2 factor authentication
     * @param user 
     * @param recaptchaverifier 
     */
    private setMultiFactorEnrollment = async (user: User, recaptchaverifier: ApplicationVerifier, auth: Auth, phoneNumber: string): Promise<string | null> =>{
        try {
            // get session
            const multifactorSession = await multiFactor(user).getSession()
            // specify the phone number and pass the MFA session
            const phoneInfoOptions = {
                phoneNumber: phoneNumber,
                session: multifactorSession
            };
            const phoneAuthProvider = new PhoneAuthProvider(auth);
            // Send SMS verification code.
        return await phoneAuthProvider.verifyPhoneNumber(phoneInfoOptions, recaptchaverifier);
        } catch (e) {
            throw new Error(`setMultiFactorEnrollment error: , ${e}`)
        }
    }

    /**
     * complete user signIn process with OTP
     * @param param0 
     * @param userCode 
     * @param user 
     * @param onSuccess 
     * @returns {User | null}
     */
    confirmOTP = async (verifier: MFAVerifier, userCode: string): Promise<User | null> =>{
        try {
            const { verificationId, resolver} = verifier
            // Ask user for the verification code. Then:
            const cred = PhoneAuthProvider.credential(verificationId, userCode);
            const multiFactorAssertion = PhoneMultiFactorGenerator.assertion(cred);

            let user: User | null = null
            // Complete enrollment.
            if(resolver){
                const credential = await resolver.resolveSignIn(multiFactorAssertion)
                user = credential.user
            } else {
                if(verifier.user){
                    // set up multifactor authentication
                    await multiFactor(verifier.user).enroll(multiFactorAssertion, "primary phone")
                    user = verifier.user
                } 
            }
            return user
        } catch (error) {
            // otp is not correct
            throw new Error(`confirmOTP error: , ${error}`)
        }
    }

    /**
     * send OTP to member
     * @param resolver 
     * @param recaptchaVerifier 
     * @param setter 
     * @returns {MFAVerifier | null}
     */
    private sendOTP =  async (resolver: MultiFactorResolver, recaptchaVerifier: ApplicationVerifier, auth: Auth) : Promise<MFAVerifier | null> =>{
        try {
            if (resolver.hints[0].factorId ===
                PhoneMultiFactorGenerator.FACTOR_ID) {
                const phoneInfoOptions = {
                    multiFactorHint: resolver.hints[0],
                    session: resolver.session
                };
                const phoneAuthProvider = new PhoneAuthProvider(auth);
                // Send SMS verification code
                const verificationId = await phoneAuthProvider.verifyPhoneNumber(phoneInfoOptions, recaptchaVerifier)
                return {verificationId, resolver}
            } else {
                // other auth factor managed to be first 
                return null
            } 
        } catch (e) {
            throw new Error(`sendOTP error: , ${e}`)
        }
    }

    /**
     * Handle email verification for user
     * @param auth 
     * @param actionCode 
     * @returns {error: string | null}
     */
    verifyEmail = async (auth: Auth, actionCode: string): Promise<boolean> => {
        try {
            // parameter.
            // Try to apply the email verification code.
            await applyActionCode(auth, actionCode)
            return true
        } catch (error) {
            throw new Error(`verifyEmail error: , ${error}`)
        }
    }

    /**
     * confirm that password reset link is correct
     * @param auth 
     * @param actionCode 
     * @returns {email: string | null} 
     */
    verifyPasswordResetLink = async (auth: Auth, actionCode:string) : Promise<string> => {
        try {
            return await verifyPasswordResetCode(auth, actionCode)
        } catch (error) {
            throw new Error(`passwordResetLink error: , ${error}`)
        }
    }

    /**
     * delete user account
     * @param user 
     */
    async deleteAccount(user: User) {
        try {
            await Promise.all([
                 deleteUser(user),
                this.delete(user.uid)
            ])
        } catch (error) {
            throw new Error(`deleteAccount error: ,${error}`)
        }
    }

    /**
     * resend email verification for expired link
     * @param auth 
     * @returns 
     */
    async sendEmailVerification(user: User): Promise<string | null> {
        // fetch current user from auth and resend email verification
        try {
            if(user){
                sendEmailVerification(user)
                return null
            } else {
                return "Unknown user account, please sign up!"
            }
        } catch (error) {
            throw new Error(`sendEmailVerification error: , ${error}`)
        }
    }
  
    async doPasswordReset (auth: Auth, actionCode: string, newPassword: string): Promise<boolean>{
  
        try {
            await confirmPasswordReset(auth, actionCode, newPassword);
            return true
        } catch (e) {
            throw new Error(`doPasswordReset error: , ${e}`)
        }
    }

}
