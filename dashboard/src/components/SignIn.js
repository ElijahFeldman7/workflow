import React from 'react'
import { signInWithGoogle } from '../firebase'

const SignIn = () => {
    return(
        <div className="min-h-screen flex items-center justify-center bg-blue-200">
            <div className="p-8 shadow-lg max-w-md w-full text-center bg-blue-100">
                <div className="mb-6">
                    <img className="w-20 h-20 mx-auto" src="/logo.png"></img>
                    <h1 className="text-3xl text-neutral-900">Workflow</h1>
                </div>
                <button
                    onClick={signInWithGoogle}
                    className="w-full bg-neutral-100 flex justify-center gap-3 px-6 py-3 border-gray-300 border text-sm text-neutral-700 hover:text-neutral-900"
                    ><img 
                        src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" 
                        alt="Google" 
                        className="w-5 h-5"
                    />
                    Sign in with Google
                </button>
            </div>

            
        </div>

    );
};
export default SignIn;