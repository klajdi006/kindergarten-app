import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  deleteField,
  doc,
  updateDoc,
} from '@angular/fire/firestore';
import {
  Messaging,
  getToken,
  isSupported,
  onMessage,
} from '@angular/fire/messaging';
import { ToastController } from '@ionic/angular/standalone';
import { AuthService } from '@app/auth/auth.service';
import { environment } from '../../environments/environment';

const DEVICE_ID_KEY = 'kg.push.deviceId';

@Injectable({ providedIn: 'root' })
export class PushService {
  private readonly firestore = inject(Firestore);
  private readonly messaging = inject(Messaging);
  private readonly auth = inject(AuthService);
  private readonly toastCtrl = inject(ToastController);

  private foregroundListenerAttached = false;

  /** Whether the current browser supports the Push API + service workers. */
  static isAvailable(): Promise<boolean> {
    return isSupported();
  }

  permissionState(): NotificationPermission | 'unsupported' {
    if (typeof Notification === 'undefined') return 'unsupported';
    return Notification.permission;
  }

  /**
   * Request permission (must be from a user gesture) and register an FCM token
   * against the signed-in user. Returns true if registration succeeded.
   */
  async enable(): Promise<boolean> {
    if (!(await PushService.isAvailable())) return false;
    if (!environment.vapidKey) {
      console.warn('[push] vapidKey not configured; skipping registration');
      return false;
    }
    const uid = this.auth.currentUser()?.uid;
    if (!uid) return false;

    let permission = Notification.permission;
    if (permission === 'default') {
      permission = await Notification.requestPermission();
    }
    if (permission !== 'granted') return false;

    const swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    const token = await getToken(this.messaging, {
      vapidKey: environment.vapidKey,
      serviceWorkerRegistration: swReg,
    });
    if (!token) return false;

    const deviceId = this.deviceId();
    await updateDoc(doc(this.firestore, 'users', uid), {
      [`fcmTokens.${deviceId}`]: token,
    });
    this.attachForegroundListener();
    return true;
  }

  /**
   * Silently refresh the token if permission is already granted (e.g. on
   * subsequent logins). Won't prompt — that requires a user gesture.
   */
  async refreshSilently(): Promise<void> {
    if (!(await PushService.isAvailable())) return;
    if (typeof Notification === 'undefined') return;
    if (Notification.permission !== 'granted') return;
    await this.enable().catch((err) => console.warn('[push] silent refresh failed', err));
  }

  async disable(): Promise<void> {
    const uid = this.auth.currentUser()?.uid;
    if (!uid) return;
    const deviceId = this.deviceId();
    try {
      await updateDoc(doc(this.firestore, 'users', uid), {
        [`fcmTokens.${deviceId}`]: deleteField(),
      });
    } catch (err) {
      console.warn('[push] disable failed', err);
    }
  }

  /**
   * Stable per-device identifier kept in localStorage. Used as the map key
   * under which this device's FCM token is stored, so re-registering on the
   * same device replaces its prior token rather than appending a new one.
   */
  private deviceId(): string {
    if (typeof localStorage === 'undefined') return 'no-storage';
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id = `d_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  }

  private attachForegroundListener(): void {
    if (this.foregroundListenerAttached) return;
    this.foregroundListenerAttached = true;
    onMessage(this.messaging, async (payload) => {
      const title = payload.notification?.title ?? payload.data?.['title'];
      const body = payload.notification?.body ?? payload.data?.['body'];
      if (!title && !body) return;
      const toast = await this.toastCtrl.create({
        header: title,
        message: body,
        duration: 3500,
        position: 'top',
        color: 'primary',
      });
      await toast.present();
    });
  }
}
