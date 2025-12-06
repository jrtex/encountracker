import { useState } from 'react';
import { CharacterList } from './components/CharacterList';
import { EncounterPlanner } from './components/EncounterPlanner';
import { InitiativeTracker } from './components/InitiativeTracker';
import { DataManager } from './components/DataManager';
import { useApp } from './AppContext';
import './App.css';

type Tab = 'characters' | 'encounters' | 'combat';

function App() {
  const { state } = useApp();
  const [activeTab, setActiveTab] = useState<Tab>('characters');

  const hasActiveEncounter = state.encounters.some(e => e.isActive);

  return (
    <div className="app">
      <header className="app-header">
        <h1>D&D Encounter Tracker</h1>
        <DataManager />
      </header>

      <nav className="tab-nav">
        <button
          className={activeTab === 'characters' ? 'active' : ''}
          onClick={() => setActiveTab('characters')}
        >
          Characters ({state.characters.length})
        </button>
        <button
          className={activeTab === 'encounters' ? 'active' : ''}
          onClick={() => setActiveTab('encounters')}
        >
          Encounters ({state.encounters.filter(e => !e.isActive).length})
        </button>
        <button
          className={activeTab === 'combat' ? 'active' : ''}
          onClick={() => setActiveTab('combat')}
          disabled={!hasActiveEncounter}
        >
          Active Combat {hasActiveEncounter && '🗡️'}
        </button>
      </nav>

      <main className="app-main">
        {activeTab === 'characters' && <CharacterList />}
        {activeTab === 'encounters' && <EncounterPlanner />}
        {activeTab === 'combat' && <InitiativeTracker />}
      </main>
    </div>
  );
}

export default App;
