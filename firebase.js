/* =============================================
   EDUTRACK AI — FIREBASE.JS
   Initialize Firebase with project config
   ============================================= */

const firebaseConfig = {
  apiKey:            "AIzaSyB1He8fcUvvCBGnIX2igkwSJa20E8yzlNw",
  authDomain:        "edutrack-ai-9debc.firebaseapp.com",
  projectId:         "edutrack-ai-9debc",
  storageBucket:     "edutrack-ai-9debc.firebasestorage.app",
  messagingSenderId: "614727970428",
  appId:             "1:614727970428:web:754211acfc76c93c1de3f9",
  measurementId:     "G-89Z9RYHX8P"
};

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db   = firebase.firestore();

// Keep user logged in for the browser session only
auth.setPersistence(firebase.auth.Auth.Persistence.SESSION);
