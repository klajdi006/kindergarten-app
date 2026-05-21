import { Routes } from '@angular/router';
import { AdminPage } from '@app/admin/admin.page';

export const routes: Routes = [
  {
    path: '',
    component: AdminPage,
    children: [
      {
        path: 'home',
        loadComponent: () => import('@app/admin/home/admin-home.page').then((m) => m.AdminHomePage),
      },
      {
        path: 'people',
        loadComponent: () =>
          import('@app/admin/people/admin-people.page').then((m) => m.AdminPeoplePage),
        children: [
          {
            path: 'parents',
            loadComponent: () =>
              import('@app/admin/parents/admin-parents/admin-parents.page').then((m) => m.AdminParentsPage),
          },
          {
            path: 'children',
            loadComponent: () =>
              import('@app/admin/children/admin-children/admin-children.page').then((m) => m.AdminChildrenPage),
          },
          {
            path: 'departments',
            loadComponent: () =>
              import('@app/admin/departments/admin-departments/admin-departments.page').then((m) => m.AdminDepartmentsPage),
          },
          {
            path: 'staff',
            loadComponent: () =>
              import('@app/admin/staff/admin-staff/admin-staff.page').then((m) => m.AdminStaffPage),
          },
          { path: '', redirectTo: 'parents', pathMatch: 'full' },
        ],
      },
      {
        path: 'content',
        loadComponent: () =>
          import('@app/admin/content/admin-content.page').then((m) => m.AdminContentPage),
        children: [
          {
            path: 'posts',
            loadComponent: () =>
              import('@app/admin/posts/admin-posts/admin-posts.page').then((m) => m.AdminPostsPage),
          },
          {
            path: 'albums',
            loadComponent: () =>
              import('@app/admin/albums/admin-albums/admin-albums.page').then((m) => m.AdminAlbumsPage),
          },
          {
            path: 'albums/:id',
            loadComponent: () =>
              import('@app/admin/albums/admin-album-detail/admin-album-detail.page').then((m) => m.AdminAlbumDetailPage),
          },
          { path: '', redirectTo: 'posts', pathMatch: 'full' },
        ],
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
        loadComponent: () => import('@app/settings/settings.page').then((m) => m.SettingsPage),
      },
      { path: '', redirectTo: 'home', pathMatch: 'full' },
    ],
  },
];
