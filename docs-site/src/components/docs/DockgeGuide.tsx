
export function DockgeGuide() {
    return (
        <div className="space-y-6">
            <div className="border-b border-white/10 pb-6">
                <h1 className="text-3xl font-bold mb-2">Dockge</h1>
                <p className="text-xl text-gray-400">Dockge is a lightweight and efficient Docker management tool.</p>
            </div>
            
            <div className="p-6 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
                <h3 className="text-lg font-semibold text-yellow-200 mb-2">Documentation Coming Soon</h3>
                <p className="text-gray-400">
                    We are currently writing the detailed setup guide for Dockge. 
                    Please check back later or contribute to the docs!
                </p>
            </div>
            
            <div className="grid md:grid-cols-2 gap-6">
                <div className="p-6 bg-slate-900/50 rounded-xl border border-white/10">
                    <h3 className="font-semibold mb-4">Quick Links</h3>
                    <ul className="space-y-2 text-sm text-gray-400">
                        <li>• <a href="#" className="hover:text-primary transition-colors">Official Website</a></li>
                        <li>• <a href="#" className="hover:text-primary transition-colors">Documentation</a></li>
                        <li>• <a href="#" className="hover:text-primary transition-colors">GitHub Repository</a></li>
                    </ul>
                </div>
            </div>
        </div>
    )
}
