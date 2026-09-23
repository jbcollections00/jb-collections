export default function MaintenancePage() {
  return (
    <div style={{
      backgroundColor: '#0f0f12',
      color: '#ffffff',
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      padding: '20px'
    }}>
      <div style={{
        background: '#18181c',
        border: '1px solid #2a2a32',
        borderRadius: '16px',
        padding: '40px 30px',
        maxWidth: '500px',
        width: '100%',
        textAlign: 'center',
        boxShadow: '0 20px 40px rgba(0,0,0,0.6)'
      }}>
        <div style={{ fontSize: '60px', marginBottom: '20px' }}>🚧</div>
        <div style={{
          display: 'inline-block',
          background: 'rgba(255, 71, 87, 0.15)',
          color: '#ff4757',
          border: '1px solid #ff4757',
          padding: '8px 16px',
          borderRadius: '50px',
          fontSize: '0.85rem',
          fontWeight: 'bold',
          marginBottom: '20px'
        }}>
          MAJOR SITE UPGRADE IN PROGRESS
        </div>
        <h1 style={{ color: '#ff4757', fontSize: '1.8rem', marginBottom: '12px' }}>
          Under Maintenance
        </h1>
        <p style={{ color: '#a0a0ab', fontSize: '0.95rem', lineHeight: '1.6', marginBottom: '20px' }}>
          Pansamantalang hindi ma-access ang <strong>JB-Collections.com</strong> habang inililipat natin ang site sa bagong <strong>Album Style System</strong>.
        </p>
        <div style={{
          background: '#22222a',
          borderLeft: '4px solid #ff4757',
          padding: '12px',
          borderRadius: '4px',
          textAlign: 'left',
          fontSize: '0.85rem',
          color: '#ccc'
        }}>
          <strong>🔒 Paalala sa Members:</strong> Safe ang inyong accounts, membership tiers, at naipong coins. Babalik ang access kapag natapos ang maintenance.
        </div>
      </div>
    </div>
  );
}