// Simple test script for campaign CRUD operations
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

async function listCampaigns() {
  const response = await fetch(`${BASE_URL}/campaigns`, {
    headers: { 'Authorization': `Bearer ${authToken}` }
  });

  const data = await response.json();
  if (data.success) {
    console.log(`✓ Listed ${data.data.length} campaigns`);
    data.data.forEach(c => console.log(`  - ${c.name}: ${c.description}`));
    return data.data;
  }
  console.error('✗ List campaigns failed:', data.message);
  return [];
}

async function updateCampaign(id, name, description) {
  const response = await fetch(`${BASE_URL}/campaigns/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    },
    body: JSON.stringify({ name, description })
  });

  const data = await response.json();
  if (data.success) {
    console.log(`✓ Updated campaign ${id}: ${name}`);
    return data.data;
  }
  console.error('✗ Update campaign failed:', data.message);
  return null;
}

async function deleteCampaign(id) {
  const response = await fetch(`${BASE_URL}/campaigns/${id}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${authToken}` }
  });

  const data = await response.json();
  if (data.success) {
    console.log(`✓ Deleted campaign ${id}`);
    return true;
  }
  console.error('✗ Delete campaign failed:', data.message);
  return false;
}

async function runTests() {
  console.log('Starting campaign CRUD tests...\n');

  // Login
  if (!await login()) return;
  console.log('');

  // Create campaigns
  console.log('Creating campaigns...');
  const campaign1 = await createCampaign(
    'Lost Mine of Phandelver',
    'A classic starter adventure for new players'
  );
  const campaign2 = await createCampaign(
    'Storm King\'s Thunder',
    'Giants are causing chaos across the Sword Coast'
  );
  console.log('');

  // List campaigns
  console.log('Listing all campaigns...');
  await listCampaigns();
  console.log('');

  // Update campaign
  if (campaign1) {
    console.log('Updating campaign...');
    await updateCampaign(
      campaign1.id,
      'Lost Mine of Phandelver (Updated)',
      'An updated description for this classic adventure'
    );
    console.log('');
  }

  // List again to show update
  console.log('Listing campaigns after update...');
  await listCampaigns();
  console.log('');

  // Delete campaign
  if (campaign2) {
    console.log('Deleting campaign...');
    await deleteCampaign(campaign2.id);
    console.log('');
  }

  // List final state
  console.log('Final campaign list...');
  await listCampaigns();
  console.log('');

  console.log('Tests completed!');
}

runTests().catch(console.error);
