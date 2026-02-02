
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function verifyFolderVectors() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("❌ Missing Supabase credentials in .env.local");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  const targetFolders = ["电磁兼容+EMC", "agent开发"];

  console.log("🔍 Verifying folder vectors and tags...\n");

  for (const name of targetFolders) {
    // 1. Find folder by name
    const { data: folders, error: folderError } = await supabase
      .from("folders")
      .select("id, name, user_id")
      .ilike("name", name)
      .is("deleted_at", null);

    if (folderError) {
      console.error(`❌ Error finding folder "${name}":`, folderError.message);
      continue;
    }

    if (!folders || folders.length === 0) {
      console.log(`⚠️  Folder not found: "${name}"`);
      continue;
    }

    for (const folder of folders) {
      console.log(`📁 Folder: "${folder.name}" (ID: ${folder.id})`);

      // 2. Get folder profile (vectors and tags)
      const { data: profile, error: profileError } = await supabase
        .from("folder_profiles")
        .select("*")
        .eq("id", folder.id)
        .single();

      if (profileError) {
        console.error(`   ❌ Error getting profile:`, profileError.message);
        // Try to fetch specific fields if select * fails (though it shouldn't for admin)
      } else if (!profile) {
        console.log(`   ⚠️  No profile found (Vectors might be missing)`);
      } else {
        // Check Tags
        const tags = profile.smart_tags || profile.keywords || [];
        console.log(`   ✅ Smart Tags (${tags.length}): ${JSON.stringify(tags)}`);

        // Check Name Embedding
        if (profile.name_embedding) {
          // Vectors are usually represented as strings or arrays in JS depending on the driver
          const embeddingType = typeof profile.name_embedding;
          let embeddingLength = 0;

          if (Array.isArray(profile.name_embedding)) {
            embeddingLength = profile.name_embedding.length;
          } else if (typeof profile.name_embedding === 'string') {
             // Handle pgvector string format "[0.1, 0.2, ...]"
             try {
               const parsed = JSON.parse(profile.name_embedding);
               embeddingLength = parsed.length;
             } catch (e) {
               console.log("   ⚠️  Name Embedding: Present (String format, length unknown)");
             }
          } else {
             console.log(`   ✅ Name Embedding: Present (Length: ${embeddingLength})`);
          }
        } else {
          console.log(`   ❌ Name Embedding: MISSING`);
        }

        // Check Content Embedding (if it exists)
        if (profile.content_embedding) {
            console.log(`   ✅ Content Embedding: Present`);
        } else {
            console.log(`   ℹ️  Content Embedding: Not generated (Normal for empty/new folders)`);
        }

        console.log(`   🕒 Last Updated: ${profile.updated_at}`);
      }
      console.log("---------------------------------------------------");
    }
  }
}

verifyFolderVectors().catch(console.error);
