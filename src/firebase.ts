import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getAnalytics, isSupported } from 'firebase/analytics'

const firebaseConfig = {
  apiKey: 'AIzaSyD8wHGPtA7DPpySPamomF_JTRgzjCQ5sl8',
  authDomain: 'pshsnjrotc.firebaseapp.com',
  projectId: 'pshsnjrotc',
  storageBucket: 'pshsnjrotc.firebasestorage.app',
  messagingSenderId: '492584636829',
  appId: '1:492584636829:web:7e02b00d1f27c299859f74',
  measurementId: 'G-TVL0Q0QCK9',
}

export const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)
export let analytics: ReturnType<typeof getAnalytics> | undefined

isSupported()
  .then((supported) => {
    if (supported) {
      analytics = getAnalytics(app)
    }
  })
  .catch(() => {
    // Analytics is optional in unsupported environments.
  })

export default firebaseConfig
