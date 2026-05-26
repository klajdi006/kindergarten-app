import { Injectable, computed, inject, signal } from '@angular/core';
import { NavigationExtras, Router } from '@angular/router';
import { AuthService } from '@app/auth/auth.service';

interface NotifPayload {
  type?: 'message' | 'post' | 'sick' | 'album';
  conversationId?: string;
  postId?: string;
  absenceId?: string;
  albumId?: string;
}

@Injectable({ providedIn: 'root' })
export class NotificationRouterService {
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);

  /**
   * Notification payload waiting to be routed. Set when a SW notification tap
   * arrives or a `?notif=` cold-start URL is detected. Consumers (e.g. the
   * root splash page) can read `hasPending()` to skip their default redirect
   * and let `handle()` own the destination instead.
   */
  private readonly pending = signal<NotifPayload | null>(null);

  readonly hasPending = computed(() => this.pending() !== null);

  queue(payload: NotifPayload): void {
    this.pending.set(payload);
  }

  consume(): NotifPayload | null {
    const p = this.pending();
    this.pending.set(null);
    return p;
  }

  async handle(payload: NotifPayload): Promise<void> {
    const role = this.auth.role();
    if (!role) return;
    const shell = role === 'admin' ? 'admin' : role === 'employee' ? 'employee' : 'parent';

    switch (payload.type) {
      case 'message':
        if (payload.conversationId) {
          await this.navigateInTab(
            `/${shell}/messages`,
            [`/${shell}/messages`, payload.conversationId],
          );
        }
        return;
      case 'post':
        await this.navigateInTab(
          `/${shell}/posts`,
          [`/${shell}/posts`],
          payload.postId ? { queryParams: { focus: payload.postId } } : undefined,
        );
        return;
      case 'sick':
        if (shell === 'employee') {
          await this.navigateInTab('/employee/home', ['/employee/home']);
        }
        return;
      case 'album': {
        // Albums are an employee/parent feature; admins don't receive these.
        if (shell === 'admin') return;
        const albumsBase = `/${shell}/albums`;
        if (payload.albumId) {
          await this.navigateInTab(albumsBase, [albumsBase, payload.albumId]);
        } else {
          await this.navigateInTab(albumsBase, [albumsBase]);
        }
        return;
      }
    }
  }

  /**
   * Ionic's `ion-tabs` only switches the visible tab when navigation matches a
   * tab base path. Navigating directly to a deep child route (e.g. a specific
   * conversation) from another tab leaves the previous tab visible even though
   * the URL is correct. Two-step nav — tab base, then the deep route on the
   * next tick — gives ion-tabs a chance to switch first.
   */
  private async navigateInTab(
    tabBase: string,
    deep: unknown[],
    extras?: NavigationExtras,
  ): Promise<void> {
    const onTab = this.router.url === tabBase || this.router.url.startsWith(tabBase + '/')
      || this.router.url.startsWith(tabBase + '?');
    if (!onTab) {
      await this.router.navigateByUrl(tabBase);
      await new Promise((r) => setTimeout(r, 0));
    }
    await this.router.navigate(deep, extras);
  }
}
