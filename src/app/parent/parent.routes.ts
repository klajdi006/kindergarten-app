import { Routes } from '@angular/router';
import { ParentPage } from '@app/parent/parent.page';

export const routes: Routes = [
  {
    path: '',
    component: ParentPage,
    children: [
      {
        path: 'posts',
        loadComponent: () =>
          import('@app/parent/posts/parent-posts.page').then((m) => m.ParentPostsPage),
      },
      {
        path: 'children',
        loadComponent: () =>
          import('@app/parent/children/parent-children/parent-children.page').then((m) => m.ParentChildrenPage),
      },
      {
        path: 'children/:id',
        loadComponent: () =>
          import('@app/parent/children/parent-child-detail/parent-child-detail.page').then((m) => m.ParentChildDetailPage),
      },
      {
        path: 'messages',
        loadComponent: () =>
          import('@app/shared/components/messages/messages-list/messages-list.page').then(
            (m) => m.MessagesListPage,
          ),
      },
      {
        path: 'messages/:id',
        loadComponent: () =>
          import('@app/shared/components/messages/conversation/conversation.page').then(
            (m) => m.ConversationPage,
          ),
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('@app/settings/settings.page').then((m) => m.SettingsPage),
      },
      { path: '', redirectTo: 'posts', pathMatch: 'full' },
    ],
  },
];
