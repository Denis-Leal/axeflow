# app/core/firebase.py
import os
import json
import firebase_admin
from firebase_admin import credentials

def init_firebase():
    if not firebase_admin._apps:
        cred_json = os.getenv("FIREBASE_CREDENTIALS")

        if not cred_json:
            raise ValueError("FIREBASE_CREDENTIALS environment variable is not set")
        
        cred_dict = json.loads(cred_json)

        cred_dict["private_key"] = cred_dict["private_key"].replace("\\n", "\n")
        
        print(cred_dict["private_key"][:100])
        
        cred = credentials.Certificate(cred_dict)

        firebase_admin.initialize_app(cred)