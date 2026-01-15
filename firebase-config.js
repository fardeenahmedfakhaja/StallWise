// Firebase Configuration
// IMPORTANT: Replace these values with your own Firebase configuration
// Get this from Firebase Console > Project Settings > General > Your apps

const firebaseConfig = {
    apiKey: "AIzaSyCuK0HJg-DieDBpAdPW66rRClA1SqdplMw",
    authDomain: "eventpos-a36d3.firebaseapp.com",
    projectId: "eventpos-a36d3",
    storageBucket: "eventpos-a36d3.firebasestorage.app",
    messagingSenderId: "591633654350",
    appId: "1:591633654350:web:b280b477af8641c81ed91f",
    measurementId: "G-XTZQEK2RJK"
  };

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize Firebase services
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

// Google Auth Provider
const googleProvider = new firebase.auth.GoogleAuthProvider();

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { firebase, auth, db, storage, googleProvider };
}