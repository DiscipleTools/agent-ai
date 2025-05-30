const { MongoClient } = require('mongodb');

async function extractScrapedDocs() {
  const client = new MongoClient('mongodb://localhost:27017');
  await client.connect();
  
  const db = client.db('agent-ai-server');
  const agents = db.collection('agents');
  
  // Find all agents first
  const allAgents = await agents.find({}).toArray();
  console.log(`Found ${allAgents.length} agents total`);
  
  // Find agents with any context documents
  const agentsWithContext = await agents.find({
    'contextDocuments': { $exists: true, $ne: [] }
  }).toArray();
  console.log(`Found ${agentsWithContext.length} agents with context documents`);
  
  // Find agents with website context documents
  const agentsWithWebsites = await agents.find({
    'contextDocuments.type': 'website'
  }).toArray();
  console.log(`Found ${agentsWithWebsites.length} agents with website documents`);
  
  let output = 'SCRAPED WEBSITE DOCUMENTS - FULL CONTENT\n';
  output += '='.repeat(50) + '\n\n';
  
  let pageCount = 0;
  let docCount = 0;
  
  for (const agent of agentsWithWebsites) {
    console.log(`Processing agent: ${agent.name}`);
    const websiteDocs = agent.contextDocuments.filter(doc => doc.type === 'website');
    console.log(`  Found ${websiteDocs.length} website documents`);
    
    for (const doc of websiteDocs) {
      docCount++;
      output += `DOCUMENT ${docCount}:\n`;
      output += `Agent: ${agent.name}\n`;
      output += `Website: ${doc.url}\n`;
      output += `Filename: ${doc.filename}\n`;
      output += `Total Pages: ${doc.metadata?.totalPages || 'Unknown'}\n`;
      output += `Content Length: ${doc.content?.length || 0} characters\n`;
      output += `Uploaded: ${new Date(doc.uploadedAt).toLocaleString()}\n`;
      output += '-'.repeat(40) + '\n';
      
      // Show full content structure
      const content = doc.content || '';
      output += `Full Content:\n`;
      output += content + '\n';
      output += '\n' + '='.repeat(50) + '\n\n';
      
      // Try to extract individual pages from the combined content
      const pageMatches = content.match(/--- Page \d+: .* ---[\s\S]*?(?=--- Page \d+:|$)/g);
      
      if (pageMatches) {
        console.log(`  Found ${pageMatches.length} page matches`);
        for (let i = 0; i < Math.min(10 - pageCount, pageMatches.length); i++) {
          const page = pageMatches[i];
          const titleMatch = page.match(/--- Page (\d+): (.*?) ---/);
          const urlMatch = page.match(/URL: (.*?)\n/);
          const contentMatch = page.match(/URL: .*?\n([\s\S]*)/);
          
          output += `\nINDIVIDUAL PAGE ${pageCount + 1}:\n`;
          output += `Title: ${titleMatch ? titleMatch[2] : 'Unknown'}\n`;
          output += `URL: ${urlMatch ? urlMatch[1] : 'Unknown'}\n`;
          output += `Full Page Content:\n`;
          output += (contentMatch ? contentMatch[1] : 'No content') + '\n';
          output += '\n' + '='.repeat(30) + '\n';
          
          pageCount++;
          if (pageCount >= 10) break;
        }
      } else {
        console.log(`  No page matches found in content`);
      }
      
      if (pageCount >= 10) break;
    }
    if (pageCount >= 10) break;
  }
  
  if (docCount === 0) {
    output += 'No scraped website documents found in the database.\n';
    
    // Show what we do have
    for (const agent of agentsWithContext) {
      output += `\nAgent: ${agent.name} has ${agent.contextDocuments.length} context documents:\n`;
      for (const doc of agent.contextDocuments) {
        output += `  - Type: ${doc.type}, URL: ${doc.url || 'N/A'}, Filename: ${doc.filename || 'N/A'}\n`;
      }
    }
  }
  
  require('fs').writeFileSync('/tmp/scraped_docs.txt', output);
  console.log(`Extracted ${docCount} documents with ${pageCount} individual pages to /tmp/scraped_docs.txt`);
  
  await client.close();
}

extractScrapedDocs().catch(console.error);