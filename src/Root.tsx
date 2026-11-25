import { useEffect, useState } from 'react';
import App from './App.tsx';
import { SHARE_PREFIX, decodeSetlist } from './share/payload.ts';
import { InvalidSharePage, SharePage } from './share/SharePage.tsx';

/** `#s=...` opens the shared setlist page; anything else is the editor */
export function Root() {
  const [hash, setHash] = useState(() => location.hash);
  useEffect(() => {
    const onHash = () => setHash(location.hash);
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  if (!hash.startsWith(SHARE_PREFIX)) return <App />;
  const setlist = decodeSetlist(hash);
  return setlist ? <SharePage setlist={setlist} /> : <InvalidSharePage />;
}
