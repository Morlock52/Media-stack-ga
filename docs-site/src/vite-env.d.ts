/// <reference types="vite/client" />

 interface ImportMetaEnv {
     readonly VITE_CONTROL_SERVER_URL?: string
     readonly VITE_OPENAI_MODEL?: string
 }

 interface ImportMeta {
     readonly env: ImportMetaEnv
 }
