import { useApp } from '../AppContext';

export const DataManager = () => {
  const { exportData, importData } = useApp();

  const handleExport = () => {
    const data = exportData();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dnd-encounters-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const data = event.target?.result as string;
      if (confirm('Importing will replace all current data. Continue?')) {
        importData(data);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="data-manager">
      <button onClick={handleExport} className="export-btn">
        Export Data
      </button>
      <label className="import-btn">
        Import Data
        <input
          type="file"
          accept=".json"
          onChange={handleImport}
          style={{ display: 'none' }}
        />
      </label>
    </div>
  );
};
