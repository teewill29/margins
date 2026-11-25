import { useEffect } from 'react';
import { createBrowserRouter, Outlet, RouterProvider, useMatches } from 'react-router';
import { BottomBar } from './components/BottomBar';
import { MicCard, UnsavedCard } from './components/MicCard';
import { RecordingDock } from './components/RecordingDock';
import { requestPersistOnce } from './db/settings';
import { DropboxAuth } from './screens/DropboxAuth';
import { Exercises } from './screens/Exercises';
import { Notebook } from './screens/Notebook';
import { NotFound } from './screens/NotFound';
import { Page } from './screens/Page';
import { Settings } from './screens/Settings';
import { Words } from './screens/Words';
import { PlayerProvider } from './state/player';
import { RecorderProvider, useRecorder } from './state/recorder';
import { ToastProvider } from './state/toast';
import { startBackgroundSync } from './sync/dropbox';

const withBar = { bar: true };

function Frame() {
  const rec = useRecorder();
  const showBar = useMatches().some((m) => (m.handle as typeof withBar | undefined)?.bar);
  return (
    <div className="app">
      <Outlet />
      <div className="app__foot">
        <UnsavedCard />
        <MicCard />
        {rec.status !== 'idle' ? <RecordingDock /> : showBar && <BottomBar />}
      </div>
    </div>
  );
}

function Root() {
  useEffect(() => {
    void requestPersistOnce();
    startBackgroundSync();
  }, []);
  return (
    <ToastProvider>
      <PlayerProvider>
        <RecorderProvider>
          <Frame />
        </RecorderProvider>
      </PlayerProvider>
    </ToastProvider>
  );
}

const router = createBrowserRouter([
  {
    element: <Root />,
    children: [
      { path: '/', element: <Notebook />, handle: withBar },
      { path: '/exercises', element: <Exercises />, handle: withBar },
      { path: '/page/:id', element: <Page />, handle: withBar },
      { path: '/settings', element: <Settings /> },
      { path: '/words', element: <Words /> },
      { path: '/auth/dropbox', element: <DropboxAuth /> },
      { path: '*', element: <NotFound /> },
    ],
  },
]);

export function App() {
  return <RouterProvider router={router} />;
}
