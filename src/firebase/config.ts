import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// SUBSTITUA ESTE BLOCO PELO SEU CÓDIGO FIREBASE REAL!
const firebaseConfig = {
  apiKey: "AIzaSy...seu_api_key_aqui",
  authDomain: "crm-seu-nome.firebaseapp.com",
  projectId: "crm-seu-nome",
  storageBucket: "crm-seu-nome.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abcdef1234567890"
};

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);

// Inicializa o Firestore (o nosso Banco de Dados)
export const db = getFirestore(app);