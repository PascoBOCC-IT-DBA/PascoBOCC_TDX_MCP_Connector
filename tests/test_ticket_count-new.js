/**
 * Test: Count New Tickets
 * Description: Retrieves and counts newly created tickets in your TDX system.
 *              Useful for tracking the volume of new incoming requests.
 */

import { fileURLToPath } from "url";
import { dirname } from "path";
import { TdxAuth } from "../dist/auth.js";
import { loadConfig } from "../dist/config.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const config = loadConfig();
const auth = new TdxAuth(config);

// Get token
const token = await auth.getToken();

// Calculate yesterday's date at midnight
const yesterday = new Date();
yesterday.setDate(yesterday.getDate() - 1);
yesterday.setHours(0, 0, 0, 0);
const yesterdayISO = yesterday.toISOString().split("T")[0]; // YYYY-MM-DD format

console.log(`Querying for tickets created since: ${yesterdayISO}`);

// Query for all tickets with high max results
const searchBody = {
  MaxResults: 5000
};

try {
  const response = await fetch(`${config.baseUrl}/${config.appId}/tickets/search`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(searchBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Error: ${response.status} - ${errorText}`);
    process.exit(1);
  }

  const data = await response.json();
  
  if (Array.isArray(data)) {
    // Filter tickets created since yesterday
    const yesterdayTime = yesterday.getTime();
    const newTickets = data.filter(ticket => {
      const ticketDate = new Date(ticket.CreatedDate);
      return ticketDate.getTime() >= yesterdayTime;
    });

    console.log(`\nTotal new tickets since yesterday: ${newTickets.length}`);
    
    // Show summary, sorted by most recent first
    if (newTickets.length > 0) {
      newTickets.sort((a, b) => new Date(b.CreatedDate) - new Date(a.CreatedDate));
      
      console.log("\nMost recent tickets:");
      newTickets.slice(0, 10).forEach((ticket, index) => {
        const createdDate = new Date(ticket.CreatedDate).toLocaleString();
        console.log(`${index + 1}. ID: ${ticket.ID}, Title: ${ticket.Title}, Created: ${createdDate}`);
      });
      
      if (newTickets.length > 10) {
        console.log(`... and ${newTickets.length - 10} more`);
      }
    }
  } else {
    console.log("Response:", JSON.stringify(data, null, 2));
  }
} catch (error) {
  console.error("Error querying tickets:", error);
  process.exit(1);
}
