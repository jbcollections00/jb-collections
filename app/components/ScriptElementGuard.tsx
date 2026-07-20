'use client';

import { useEffect } from 'react';

export default function ScriptElementGuard() {
  useEffect(() => {
    // 1. Catch standard script runtime crashes
    const handleThirdPartyErrors = (e: ErrorEvent) => {
      if (
        (e.filename && (e.filename.includes('VM') || e.filename.includes('invoke.js'))) ||
        (e.message && (e.message.includes('JSON') || e.message.includes('Unexpected token')))
      ) {
        e.preventDefault();
        e.stopPropagation();
        return true;
      }
    };

    // 2. Catch failed async fetch/network responses (like the promaffinspector fetch crash)
    const handleUnhandledRejections = (e: PromiseRejectionEvent) => {
      const reason = e.reason?.message || String(e.reason);
      if (reason.includes('JSON') || reason.includes('Unexpected end of input') || reason.includes('protraffinspector')) {
        e.preventDefault();
        e.stopPropagation();
        return true;
      }
    };

    window.addEventListener('error', handleThirdPartyErrors, true);
    window.addEventListener('unhandledrejection', handleUnhandledRejections, true);
    
    return () => {
      window.removeEventListener('error', handleThirdPartyErrors, true);
      window.removeEventListener('unhandledrejection', handleUnhandledRejections, true);
    };
  }, []);

  return null;
}