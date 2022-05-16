// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
    apiKey: "AIzaSyCdfH-MjQW0T_FXxblp2483boacfdRTG-I",
    authDomain: "quizlet-vk.firebaseapp.com",
    projectId: "quizlet-vk",
    storageBucket: "quizlet-vk.appspot.com",
    messagingSenderId: "295294509329",
    appId: "1:295294509329:web:f26d3fa319a953e6466cb0",
    measurementId: "G-5NT7Y4HQPR"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const firestore = getFirestore(app)