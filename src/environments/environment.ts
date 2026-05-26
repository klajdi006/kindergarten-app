// This file can be replaced during build by using the `fileReplacements` array.
// `ng build` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.

export const environment = {
  production: false,
  firebase: {
    apiKey: "AIzaSyCYJV34OFxv1FBeI5W36eWEiW5JzWHzih0",
    authDomain: "e-kindergaten-app.firebaseapp.com",
    projectId: "e-kindergaten-app",
    storageBucket: "e-kindergaten-app.firebasestorage.app",
    messagingSenderId: "510259741725",
    appId: "1:510259741725:web:1229444495b081ab75f2f4",
    measurementId: "G-TPM5KE3ZY0"
  },
  // Generate in Firebase Console → Project Settings → Cloud Messaging →
  // Web configuration → "Generate key pair". Without this, push registration
  // will silently no-op.
  vapidKey: "BARoAjVpZZgHYW4BtnnQuLbTmUqZiijdT5k-gh56CgM91qKiZ6TRsAH-ClPMlOWy7XnY7DCsQZ0AqQ52Kf0LNU0"
};

/*
 * For easier debugging in development mode, you can import the following file
 * to ignore zone related error stack frames such as `zone.run`, `zoneDelegate.invokeTask`.
 *
 * This import should be commented out in production mode because it will have a negative impact
 * on performance if an error is thrown.
 */
// import 'zone.js/plugins/zone-error';  // Included with Angular CLI.
