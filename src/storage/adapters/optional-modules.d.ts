// Stubs para SDKs opcionales: solo se cargan dinámicamente cuando el adapter
// correspondiente se selecciona en runtime. Sin esto, TS rompe en máquinas que
// no tengan estos paquetes instalados.
declare module "@vercel/blob";
declare module "@aws-sdk/client-s3";
declare module "@aws-sdk/s3-request-presigner";
