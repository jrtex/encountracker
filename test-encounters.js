// Simple test script for encounter CRUD operations
const BASE_URL = 'http://localhost:3000/api';
let authToken = null;

async function login() {
  const response = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' })
  });

  const data = await response.json();
  if (data.success) {
    authToken = data.data.token;
    console.log('✓ Login successful');
    return true;
  }
  console.error('✗ Login failed:', data.message);
  return false;
}

async function createCampaign(name, description) {
  const response = await fetch(`${BASE_URL}/campaigns`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    },
    body: JSON.stringify({ name, description })
  });

  const data = await response.json();
  if (data.success) {
    console.log(`✓ Created campaign: ${name} (ID: ${data.data.id})`);
    return data.data;
  }
  console.error('✗ Create campaign failed:', data.message);
  return null;
}

async function createEncounter(campaignId, name, description, difficulty, status) {
  const response = await fetch(`${BASE_URL}/encounters`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    },
    body: JSON.stringify({ campaign_id: campaignId, name, description, difficulty, status })
  });

  const data = await response.json();
  if (data.success) {
    console.log(`✓ Created encounter: ${name} (ID: ${data.data.id})`);
    return data.data;
  }
  console.error('✗ Create encounter failed:', data.message, data.errors);
  return null;
}

async function listEncounters(campaignId = null) {
  const url = campaignId ? `${BASE_URL}/encounters?campaign_id=${campaignId}` : `${BASE_URL}/encounters`;
  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${authToken}` }
  });

  const data = await response.json();
  if (data.success) {
    console.log(`✓ Listed ${data.data.length} encounters`);
    data.data.forEach(e => console.log(`  - [${e.difficulty}/${e.status}] ${e.name}: ${e.description}`));
    return data.data;
  }
  console.error('✗ List encounters failed:', data.message);
  return [];
}

async function updateEncounter(id, name, description, difficulty, status) {
  const response = await fetch(`${BASE_URL}/encounters/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    },
    body: JSON.stringify({ name, description, difficulty, status })
  });

  const data = await response.json();
  if (data.success) {
    console.log(`✓ Updated encounter ${id}: ${name}`);
    return data.data;
  }
  console.error('✗ Update encounter failed:', data.message);
  return null;
}

async function deleteEncounter(id) {
  const response = await fetch(`${BASE_URL}/encounters/${id}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${authToken}` }
  });

  const data = await response.json();
  if (data.success) {
    console.log(`✓ Deleted encounter ${id}`);
    return true;
  }
  console.error('✗ Delete encounter failed:', data.message);
  return false;
}

async function runTests() {
  console.log('Starting encounter CRUD tests...\n');

  // Login
  if (!await login()) return;
  console.log('');

  // Create a test campaign
  console.log('Creating test campaign...');
  const campaign = await createCampaign(
    'Test Campaign for Encounters',
    'A campaign to test encounter functionality'
  );
  if (!campaign) return;
  console.log('');

  // Create encounters
  console.log('Creating encounters...');
  const encounter1 = await createEncounter(
    campaign.id,
    'Goblin Ambush',
    'A group of goblins attacks the party on the road',
    'easy',
    'pending'
  );
  const encounter2 = await createEncounter(
    campaign.id,
    'Dragon\'s Lair',
    'The final confrontation with an ancient red dragon',
    'deadly',
    'pending'
  );
  const encounter3 = await createEncounter(
    campaign.id,
    'Bandits in the Forest',
    'A group of bandits demands a toll',
    'medium',
    'active'
  );
  console.log('');

  // List all encounters
  console.log('Listing all encounters...');
  await listEncounters();
  console.log('');

  // List encounters for specific campaign
  console.log(`Listing encounters for campaign ${campaign.id}...`);
  await listEncounters(campaign.id);
  console.log('');

  // Update encounter
  if (encounter1) {
    console.log('Updating encounter...');
    await updateEncounter(
      encounter1.id,
      'Goblin Ambush (Updated)',
      'An updated description with more goblins!',
      'hard',
      'completed'
    );
    console.log('');
  }

  // List again to show update
  console.log('Listing encounters after update...');
  await listEncounters(campaign.id);
  console.log('');

  // Delete encounter
  if (encounter2) {
    console.log('Deleting encounter...');
    await deleteEncounter(encounter2.id);
    console.log('');
  }

  // List final state
  console.log('Final encounter list...');
  await listEncounters(campaign.id);
  console.log('');

  console.log('Tests completed!');
}

runTests().catch(console.error);
