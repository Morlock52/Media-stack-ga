import React from 'react';

interface GuideSectionProps {
    id: string;
    title: string;
    children: React.ReactNode;
    imageSrc?: string;
    imageAlt?: string;
    reverse?: boolean;
}

export const GuideSection: React.FC<GuideSectionProps> = ({ id, title, children, imageSrc, imageAlt, reverse = false }) => {
    return (
        <div id={id} className={`flex flex-col ${reverse ? 'lg:flex-row-reverse' : 'lg:flex-row'} gap-8 items-center py-12 border-b border-white/5 last:border-0`}>
            <div className="flex-1 space-y-4">
                <h3 className="text-2xl font-bold text-white">{title}</h3>
                <div className="text-muted-foreground leading-relaxed space-y-4">
                    {children}
                </div>
            </div>
            {imageSrc && (
                <div className="flex-1 w-full">
                    <div className="relative group">
                        <div className="absolute -inset-1 bg-gradient-to-r from-primary to-purple-600 rounded-xl blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
                        <img
                            src={imageSrc}
                            alt={imageAlt || title}
                            className="relative rounded-xl border border-white/10 shadow-2xl w-full object-cover aspect-video bg-background/50"
                        />
                    </div>
                </div>
            )}
        </div>
    );
};
