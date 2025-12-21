import { Container } from 'lucide-react'
import { AppGuideLayout } from './AppGuideLayout'

export function PortainerGuide() {
    return (
        <AppGuideLayout
            icon={<Container className="w-7 h-7 text-blue-400" />}
            title="Portainer"
            subtitle="Docker Container Management"
            category="System"
            estimatedTime="5 minutes"
        >
            <section className="space-y-6 text-sm text-gray-300">
                <div>
                    <h3 className="text-base font-semibold text-white mb-2">Managing your Stack</h3>
                    <p>
                        Portainer gives you a graphical interface to manage your Docker containers, images, and networks.
                    </p>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-white mb-2">Quick Actions</h3>
                    <ul className="list-disc list-inside space-y-2 text-gray-300">
                        <li>
                            <strong>Access:</strong> <a href="http://localhost:9000" target="_blank" rel="noreferrer noopener" className="text-primary hover:underline">http://localhost:9000</a>
                        </li>
                        <li>
                            <strong>View Logs:</strong> Click on a container → Click "Logs" icon.
                        </li>
                        <li>
                            <strong>Restart Container:</strong> Click on a container → Click "Restart".
                        </li>
                        <li>
                            <strong>Console Access:</strong> Click on a container → Click "&gt;_ Console" → Connect. This gives you a root shell inside the container.
                        </li>
                    </ul>
                </div>
            </section>
        </AppGuideLayout>
    )
}
