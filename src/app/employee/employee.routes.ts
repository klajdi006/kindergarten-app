import { Routes } from '@angular/router';
import { EmployeePage } from '@app/employee/employee.page';

export const routes: Routes = [
  {
    path: '',
    component: EmployeePage,
    children: [
      {
        path: 'home',
        loadComponent: () =>
          import('@app/employee/home/employee-home.page').then((m) => m.EmployeeHomePage),
      },
      {
        path: 'posts',
        loadComponent: () =>
          import('@app/employee/posts/employee-posts.page').then((m) => m.EmployeePostsPage),
      },
      {
        path: 'albums',
        loadComponent: () =>
          import('@app/employee/albums/employee-albums.page').then((m) => m.EmployeeAlbumsPage),
      },
      {
        path: 'albums/:id',
        loadComponent: () =>
          import('@app/employee/albums/employee-album-detail.page').then(
            (m) => m.EmployeeAlbumDetailPage,
          ),
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
      { path: '', redirectTo: 'home', pathMatch: 'full' },
    ],
  },
];
