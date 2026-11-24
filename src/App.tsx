import { createBrowserRouter, Outlet, RouterProvider } from 'react-router';
import { BottomBar } from './components/BottomBar';
import { Exercises } from './screens/Exercises';
import { Notebook } from './screens/Notebook';
import { NotFound } from './screens/NotFound';
import { Page } from './screens/Page';
import { Settings } from './screens/Settings';
import { Words } from './screens/Words';

function Frame() {
  return (
    <div className="app">
      <Outlet />
    </div>
  );
}

function WithBar() {
  return (
    <>
      <Outlet />
      <BottomBar />
    </>
  );
}

const router = createBrowserRouter([
  {
    element: <Frame />,
    children: [
      {
        element: <WithBar />,
        children: [
          { path: '/', element: <Notebook /> },
          { path: '/exercises', element: <Exercises /> },
          { path: '/page/:id', element: <Page /> },
        ],
      },
      { path: '/settings', element: <Settings /> },
      { path: '/words', element: <Words /> },
      { path: '*', element: <NotFound /> },
    ],
  },
]);

export function App() {
  return <RouterProvider router={router} />;
}
