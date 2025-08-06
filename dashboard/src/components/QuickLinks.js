import React from 'react';

const QuickLinks = () => {
  const links = [
    { title: 'Discord', url: 'https://discord.com/app' },
    { title: 'GitHub', url: 'https://github.com' },
    { title: 'Ion', url: 'https://ion.tjhsst.edu'},
    { title: 'Gitlab', url: 'https://gitlab.tjhsst.edu' },
    {title: 'To-Do', url: 'https://elijahfeldman7.github.io/to-do-list'},
    {title: 'Me', url: 'https://elijahfeldman.me'}
  ];

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Quick Links</h2>
      <div className="links-grid grid grid-cols-[repeat(auto-fill,_minmax(180px,_1fr))] gap-4">
        {links.map((link, index) => (
          <a key={index} href={link.url} target="_blank" rel="noopener noreferrer" className="link-card block p-4 bg-gray-100 border border-gray-200 rounded-lg transition-all hover:transform hover:-translate-y-1 hover:shadow-md hover:border-blue-500">
            <div className="link-card-title font-bold text-lg mb-1">{link.title}</div>
            <div className="link-card-url text-sm text-gray-600 break-all">{link.url}</div>
          </a>
        ))}
      </div>
    </div>
  );
};

export default QuickLinks;