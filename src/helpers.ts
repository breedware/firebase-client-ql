
/**
 * Generates random strings of n length
 * containing 0-9 and Aa-Zz
 * @param length
 * @returns 
 */
export const generateRandomString = (length: number): string => {
    if(length > 60){
        throw new Error(`Maximum generatable character is 60, ${length} was required`)
    }
    var result           = '';
    var characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var charactersLength = characters.length;
    for ( var i = 0; i < length; i++ ) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}



/**
 * converts camel cases to title case
 * @param key 
 * @returns 
 */
export const camelToTitleCase = (key: string): string => {
  // convert first letter to uppercase
  const topic = key[0].toUpperCase()+key.slice(1)

  let result = ''
  let i = 0
  // add spacing to other letters
  while(i < topic.length){
      if(i===0){
          result+=topic.charAt(i)
      } else {
          if(topic.charAt(i)===topic.charAt(i).toUpperCase()){
              result+=` ${topic.charAt(i)}`
          }else{
              result+=topic.charAt(i)
          }
      }
      i++
  }
  return result
}


/**
* format unicode characters
* @param input 
* @returns 
*/
export function convertUnicode(input: string) {
  return input.replace(/\\+u([0-9a-fA-F]{4})/g, (a,b) =>
    String.fromCharCode(parseInt(b, 16)));
}

/**
* converts number to money format of comma 
* separated thousands
* @param x 
* @returns 
*/
export const moneyFormatter = (x:number | string, shorten:boolean = true, decimailPlaces?: number):string => {
  if(x===undefined){
    return ""
  }
  const base: number = 100000
  // number is less than a million
  const num = parseInt(x as string)
  if(num < base || !shorten){
      return num.toFixed(decimailPlaces).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }else{
      let val = '';
    //   check is less than a million
    if(num/base < 10){
        val = (num/1000).toFixed(decimailPlaces) + "K"
      // check number is less than a billion
    }else if(num < (base * 10000)){
          val = (num/(base * 10)).toFixed(decimailPlaces) + "M"
      }else{
          val = (num/(base * 10000)).toFixed(decimailPlaces) + "B"
      }
      return val
  }
}


/**
 * Returns a date that is `daysApart` days before the given `startDate`.
 * 
 * @param startDate - The original date from which to subtract days.
 * @param daysApart - The number of days to subtract from `startDate`.
 * @returns A new `Date` object representing the date `daysApart` days before `startDate`.
 */
export function getDaysAgo(startDate: Date, daysApart: number): Date {
    // Create a local copy of the start date by converting it to a date string and then back to a Date object.
    const localCopy = new Date(startDate.toDateString());

    // Subtract the specified number of days from the local copy's date and return the resulting date.
    return new Date(localCopy.setDate(localCopy.getDate() + daysApart));
}

/**
 * Calculates how long ago a given date is from now and returns a human-readable string.
 * 
 * @param {Date | string | number} dateInput - The date to compare against the current time.
 * @returns {string} - A string describing how long ago the date was (e.g., "5 minutes ago", "2 days ago").
 */
export function timeAgo(dateInput: Date | string | number): string {
    // Ensure the input is a Date object
    const date = new Date(dateInput);
    
    if (isNaN(date.getTime())) {
        throw new Error("Invalid date input");
    }

    // Get the current date and time
    const now = new Date();

    // Calculate the difference in seconds between the current time and the given date
    const secondsAgo = Math.floor((now.getTime() - date.getTime()) / 1000);

    // Calculate the difference in minutes
    const minutesAgo = Math.floor(secondsAgo / 60);
    if (minutesAgo < 1) return "Just now"; // Less than a minute ago

    // Calculate the difference in hours
    const hoursAgo = Math.floor(minutesAgo / 60);
    if (hoursAgo < 1) return `${minutesAgo} minute${minutesAgo !== 1 ? 's' : ''} ago`; // Less than an hour ago

    // Calculate the difference in days
    const daysAgo = Math.floor(hoursAgo / 24);
    if (daysAgo < 1) return `${hoursAgo} hour${hoursAgo !== 1 ? 's' : ''} ago`; // Less than a day ago

    // Calculate the difference in months
    const monthsAgo = Math.floor(daysAgo / 30);
    if (daysAgo < 30) return `${daysAgo} day${daysAgo !== 1 ? 's' : ''} ago`; // Less than a month ago

    // Calculate the difference in years
    const yearsAgo = Math.floor(monthsAgo / 12);
    if (monthsAgo < 12) return `${monthsAgo} month${monthsAgo !== 1 ? 's' : ''} ago`; // Less than a year ago

    // If more than a year ago, return the number of years
    return `${yearsAgo} year${yearsAgo !== 1 ? 's' : ''} ago`;
}

/**
 * check if a tab section is active
 * @param param0 
 * @returns boolean
 */
export const isActiveTab = ({currentTabPath,  urlSegment}:{
    currentTabPath: string,
    // urlPath: string,
    urlSegment: string []
}):boolean=>{
    return urlSegment.includes(currentTabPath) 
    || urlSegment.includes(`/${currentTabPath}`)
    || urlSegment.includes(`/${currentTabPath}/`)
    || urlSegment.includes(`${currentTabPath}/`)
}

// Function to calculate distance between two lat/lng points using Haversine formula
function getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371; // Radius of the Earth in km
    const dLat = deg2rad(lat2 - lat1); // Convert latitude difference to radians
    const dLon = deg2rad(lon2 - lon1); // Convert longitude difference to radians
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c; // Distance in km
    return distance;
}

// Helper function to convert degrees to radians
function deg2rad(deg: number) {
    return deg * (Math.PI / 180);
}

// Function to check if device is within a certain range
export function isDeviceWithinRange(deviceLat: number, deviceLon: number, targetLat: number, targetLon: number, rangeInKm: number) {
    const distance = getDistanceFromLatLonInKm(deviceLat, deviceLon, targetLat, targetLon);
    return distance <= rangeInKm; // Check if distance is within the specified range
}

// Example usage
// const deviceLat = 40.7128; // Device's latitude
// const deviceLon = -74.0060; // Device's longitude (e.g., New York City)
// const targetLat = 40.730610; // Target location's latitude (e.g., some location in NYC)
// const targetLon = -73.935242; // Target location's longitude
// const rangeInKm = 5; // 5 km range

// const isWithinRange = isDeviceWithinRange(deviceLat, deviceLon, targetLat, targetLon, rangeInKm);

// console.log(isWithinRange ? "Device is within range" : "Device is out of range");


// create range of numbers
export const range = (start: number, end: number)=>Array.from({ length: end - start + 1 }, (_, i) => start + i);

export const nairaFormatter = (amount: number): string =>{
    return `₦${moneyFormatter(amount, true, 2)}`;
}

export const camelCaseToNormal = (camelCaseStr: string) => {
    return camelCaseStr
        .replace(/([a-z])([A-Z])/g, '$1 $2') // Add space between lowercase and uppercase letters
        .replace(/^./, str => str.toUpperCase()); // Capitalize the first letter of the sentence
}

// log error in development
export const errorLogger = (...error: any)=>{
    if(window.location.hostname === 'localhost'){
        console.log(error);
    }
}

/**
 * validate email address
 * @param email 
 * @returns 
 */
export function isValidEmail(email: string): string | undefined {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const pass =  emailRegex.test(email);
    if(!pass){
        return 'Invalid email address';
    }
}

/**
 * validate password
 * must contain at least 1 uppercase
 * must not be uppercase throughout
 * must contain special character
 * must be greater or equal to 8 characters
 * @param password 
 * @returns 
 */
export function isValidPassword(password: string): string | undefined {
    // Check length
    if (password.length < 8) {
        return "Password cannot be less than 8 characters in length";
    }

    // Check for at least 1 uppercase letter
    const hasUppercase = /[A-Z]/.test(password);
    if (!hasUppercase) {
        return "Password must contain at least 1 uppercase letter";
    }

    // Ensure it's not all uppercase
    const isAllUppercase = /^[A-Z]+$/.test(password);
    if (isAllUppercase) {
        return "Password cannot be all uppercase letter";
    }

    // Check for at least 1 special character
    const hasSpecialCharacter = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    if (!hasSpecialCharacter) {
        return "Password must contain at least 1 special character";
    }

}

function isValidName(name: string) {
    // Check if name is a string
    if (typeof name !== "string") {
        return false;
    }

    // Trim any leading or trailing whitespace
    name = name.trim();

    // Define the pattern for a valid name
    const namePattern = /^[a-zA-Z]+(?: [a-zA-Z]+)*$/;

    // Check if the name matches the pattern and has at least two characters
    return name.length >= 2 && namePattern.test(name);
}

/**
 * validates name
 * @param name 
 * @returns 
 */
export function checkIsValidName(name: string): string | undefined {
    if(!isValidName(name)){
        return 'Please enter a valid value'
    }
}

/**
 * generate number of years
 * from now
 * @param timeAgo 
 * @param tense 
 * @returns 
 */
export const generateYearsPast = (timeAgo: number, tense: 'future' | 'past'): number[] => {
    const currentYear = new Date().getFullYear();
    const years = tense==='past'?
     Array.from({ length: timeAgo }, (_, i) => currentYear - (i + 1)):
     Array.from({length: timeAgo }, (_, i)=>currentYear + (i + 1));
    return years;
  };

  /**
   * change number to Alphabet
   * @param num 
   * @returns 
   */
export function numberToAlphabet(num: number): string {
    let result = "";
  
    while (num > 0) {
      // Adjust for 1-based indexing: 1 = A, 2 = B, ..., 26 = Z
      num--; 
      const charCode = (num % 26) + 65; // 65 is the ASCII value for 'A'
      result = String.fromCharCode(charCode) + result;
      num = Math.floor(num / 26);
    }
  
    return result;
  }

  /**
   * get nth array of numbers
   * @param num 
   * @param step 
   * @returns 
   */
  export const getNthNumberOfArray = (param: {num: number, step: number, start?: number})=>{
    const {num, step, start} = param;
    if (num <= 0 || step <= 0) {
          throw new Error("Both number and step must be greater than 0");
     }
     
    return Array.from({ length: Math.floor(num / step) }, (_, i) => {
      if(start){
        i = start + i - 1
        return (i + 1) * step
      }
      return (i + 1) * step
    })
  }
  

/**
 * check if all required fields are not empty
 * @param args 
 * @returns 
 */
export const checkNoEmptyField = (args: {
    requiredFields: string[],
    formData: any
}): boolean =>{
    return args.requiredFields.every(field => 
        Object.hasOwn(args.formData, field) 
        && args.formData[field] !== undefined && 
        args.formData[field] !== null && 
        args.formData[field] !== ''
    );
}

// get initials from full name
export const getInitials = (fullName?: string): string => {
    if(fullName){
        const names = fullName.trim().split(/\s+/); // Remove extra spaces and split by spaces
  
        if (names.length >= 2) {
        // Two or more names provided, return first initials
        const firstInitial = names[0].charAt(0).toUpperCase();
        const lastInitial = names[names.length - 1].charAt(0).toUpperCase();
        return `${firstInitial}${lastInitial}`;
        } 
        
        if (names.length === 1) {
        // Only one name provided, return first and last letter
        const name = names[0];
        return `${name.charAt(0).toUpperCase()}${name.charAt(name.length - 1).toUpperCase()}`;
        }
    }
  
    return ""; // Handle empty input
  }

  type TimeStamp = {
    unix: number,
    iso: string
  }


  /**
   * returns current unix and iso timestamp
   * @returns {Promise<TimeStamp>}
   */
  export  const fetchCurrentTimestamp = async(): Promise<TimeStamp> => {
    const res = await fetch('https://worldtimeapi.org/api/timezone/etc/utc');
    if (!res.ok) throw new Error('Failed to fetch time');
    const data = await res.json();
    return {
      iso: data.datetime,
      unix: data.unixtime * 1000 // Convert to milliseconds if needed
    };
  }

  /**
   * check if form has error
   * or object is not empty
   * @param formError 
   * @returns 
   */
  export const formHasError = (formError: Record<string, string | undefined>): boolean =>{
    return Object.values(formError).every(item=>item!==undefined);
  }


