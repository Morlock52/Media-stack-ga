import { UtensilsCrossed, Link as LinkIcon, CheckCircle2 } from 'lucide-react'
import { AppGuideLayout } from './AppGuideLayout'

export function MealieGuide() {
    return (
        <AppGuideLayout
            icon={<UtensilsCrossed className="w-7 h-7 text-purple-100" />}
            title="Mealie Recipe Server"
            subtitle="Host your own recipe collection and meal planner"
            category="Utility App Guide"
            estimatedTime="10–20 minutes"
        >
            <section className="space-y-4 text-sm text-gray-300">
                <div>
                    <h3 className="text-base font-semibold text-white mb-2">What Mealie does</h3>
                    <p>
                        Mealie is a self‑hosted recipe manager and meal planner. It lets you save recipes from
                        websites, organize them into categories, plan meals for the week, and generate shopping lists.
                    </p>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-white mb-2">Before you start</h3>
                    <ul className="list-disc list-inside space-y-1 text-gray-300">
                        <li>You have already run <code>docker compose up -d</code> from the folder you downloaded.</li>
                        <li>All containers are running (you can check with <code>docker compose ps</code>).</li>
                        <li>You know your server IP or domain (for example: <code>http://localhost</code> or <code>https://recipes.your-domain.com</code>).</li>
                    </ul>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-white mb-2">1. Open Mealie</h3>
                    <ol className="list-decimal list-inside space-y-1 text-gray-300">
                        <li>
                            In your browser, go to the Mealie URL from your stack. Common defaults:
                            <ul className="list-disc list-inside ml-5 text-xs text-gray-400 mt-1">
                                <li><code>http://localhost:9925</code> if running on your local machine.</li>
                                <li><code>https://mealie.your-domain.com</code> if you used a subdomain in the wizard.</li>
                            </ul>
                        </li>
                        <li>You should see the Mealie welcome / onboarding screen.</li>
                    </ol>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-white mb-2">2. Create your admin account</h3>
                    <ol className="list-decimal list-inside space-y-1 text-gray-300">
                        <li>On the first screen, choose <strong>Create account</strong> or similar.</li>
                        <li>Pick a username like <code>admin</code> or your name.</li>
                        <li>Use a strong password and store it in a password manager.</li>
                        <li>Click <strong>Create</strong> / <strong>Continue</strong> to finish the setup wizard.</li>
                    </ol>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-white mb-2">3. Basic settings</h3>
                    <ol className="list-decimal list-inside space-y-1 text-gray-300">
                        <li>Once logged in, open the sidebar and go to <strong>Settings → General</strong>.</li>
                        <li>Set your preferred language and measurement units (metric / imperial).</li>
                        <li>Optionally upload a logo or change theme colors.</li>
                        <li>Click <strong>Save</strong>.</li>
                    </ol>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-white mb-2">4. Import your first recipe</h3>
                    <ol className="list-decimal list-inside space-y-1 text-gray-300">
                        <li>Find any recipe on the web you like (for example on a food blog).</li>
                        <li>Copy the full URL from your browser.</li>
                        <li>In Mealie, click <strong>New Recipe</strong> or <strong>Import from URL</strong>.</li>
                        <li>Paste the recipe URL and click <strong>Import</strong>.</li>
                        <li>Wait a few seconds while Mealie grabs the title, ingredients, and steps.</li>
                        <li>Review the imported recipe and click <strong>Save</strong>.</li>
                    </ol>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-white mb-2">5. Organize with categories and tags</h3>
                    <ol className="list-decimal list-inside space-y-1 text-gray-300">
                        <li>Open any recipe you imported.</li>
                        <li>Look for fields like <strong>Categories</strong> and <strong>Tags</strong>.</li>
                        <li>Add simple labels like <code>Dinner</code>, <code>Vegetarian</code>, <code>Quick</code>, or <code>One‑pot</code>.</li>
                        <li>Later you can filter recipes by these labels to find ideas quickly.</li>
                    </ol>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-white mb-2">6. Create a simple meal plan</h3>
                    <ol className="list-decimal list-inside space-y-1 text-gray-300">
                        <li>Go to the <strong>Meal Planner</strong> section in the sidebar.</li>
                        <li>Select a week or specific days you want to plan.</li>
                        <li>Drag recipes from your collection onto days, or click a day and choose <strong>Add recipe</strong>.</li>
                        <li>Keep it simple at first: plan 2–3 dinners for the week.</li>
                    </ol>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-white mb-2">7. Generate a shopping list</h3>
                    <ol className="list-decimal list-inside space-y-1 text-gray-300">
                        <li>From the meal planner, look for a <strong>Shopping List</strong> or <strong>Groceries</strong> option.</li>
                        <li>Select the date range or the meals you want to include.</li>
                        <li>Mealie will combine ingredients into a single list you can use on your phone.</li>
                    </ol>
                </div>

                <div className="rounded-2xl border border-purple-500/30 bg-purple-500/5 p-4 flex items-start gap-3 text-xs text-purple-100">
                    <CheckCircle2 className="w-4 h-4 mt-0.5" />
                    <div>
                        <p className="font-semibold mb-1">Nice work!</p>
                        <p>
                            At this point Mealie is fully usable. You can slowly import more recipes over time instead of
                            trying to move everything in one day.
                        </p>
                    </div>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-white mb-2">Where this fits in your stack</h3>
                    <ul className="list-disc list-inside space-y-1 text-gray-300">
                        <li>Mealie is <strong>independent</strong> from Plex/Jellyfin – it doesn&apos;t affect playback.</li>
                        <li>It can be reached through the same domain / reverse proxy setup you used in the wizard.</li>
                        <li>You can safely restart or update Mealie without touching the rest of the media stack.</li>
                    </ul>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-white mb-2">Common issues</h3>
                    <ul className="list-disc list-inside space-y-1 text-gray-300 text-xs">
                        <li>
                            <strong>Can&apos;t reach Mealie:</strong> Check that the container is running with
                            <code>docker compose ps</code> and that the port / subdomain matches your config.
                        </li>
                        <li>
                            <strong>Recipe import fails:</strong> Some websites block scraping. Try another site, or copy
                            the ingredients manually.
                        </li>
                        <li>
                            <strong>Forgot admin password:</strong> You can recreate the Mealie container with a new
                            user, but this may reset data – check Mealie docs before doing this.
                        </li>
                    </ul>
                </div>

                <div className="flex items-center gap-2 pt-2 text-xs text-gray-400">
                    <LinkIcon className="w-4 h-4" />
                    <span>For advanced options (backups, external auth, etc.), see the official Mealie documentation.</span>
                </div>
            </section>
        </AppGuideLayout>
    )
}
