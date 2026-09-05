import React, { useState, useEffect } from "react";
import { database } from "../firebase";
import { dbRef, onValueRef, setData } from "../firebaseHelpers";

const QuickLinks = ({ user }) => {
  const defaultLinks = [
    { title: "Discord", url: "https://discord.com/app" },
    { title: "GitHub", url: "https://github.com" },
  ];

  const [links, setLinks] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    const linksRef = dbRef(`users/${user.uid}/quickLinks`);

    const unsubscribe = onValueRef(linksRef, (snapshot) => {
      const data =
        snapshot && snapshot.val
          ? snapshot.val()
          : (snapshot || {}).val && snapshot.val();
      if (data) {
        setLinks(data);
      } else {
        setLinks(defaultLinks);
        setData(linksRef, defaultLinks);
      }
    });

    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, [user]);

  useEffect(() => {
    if (!user || links.length === 0) return;

    setIsSaving(true);
    const saveTimeout = setTimeout(() => {
      const linksRef = dbRef(`users/${user.uid}/quickLinks`);
      const p = Promise.resolve(setData(linksRef, links));
      setIsSaving(false);
      p.catch(() => {});
    }, 1000);

    return () => clearTimeout(saveTimeout);
  }, [links, user]);

  const handleChange = (index, field, value) => {
    const newLinks = [...links];
    newLinks[index][field] = value;
    setLinks(newLinks);
  };

  const addNewLink = () => {
    setLinks([...links, { title: "New Link", url: "https://" }]);
  };

  const deleteLink = (index) => {
    const newLinks = links.filter((_, i) => i !== index);
    setLinks(newLinks);
  };

  return (
    <div className="bg-card shadow rounded-lg p-6 max-w-6xl mx-auto border border-border transition-colors duration-200">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-foreground">
          Quick Links
        </h2>
        <div className="flex items-center gap-3">
          {isSaving && (
            <span className="text-xs text-muted-foreground">
              Saving...
            </span>
          )}
          <button
            onClick={() => setIsEditing(!isEditing)}
            className={`p-2 rounded transition-colors ${
              isEditing
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
            title={isEditing ? "Done Editing" : "Edit Links"}
            aria-label={isEditing ? "Done editing links" : "Edit links"}
          >
            {isEditing ? (
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            ) : (
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                />
              </svg>
            )}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-[repeat(auto-fill,_minmax(200px,_1fr))] gap-4">
        {links.map((link, index) => (
          <div key={index} className="relative group">
            {!isEditing ? (
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block h-full p-4 bg-background border border-border rounded hover:border-muted-foreground/60 transition-colors"
                aria-label={`${link.title} at ${link.url}`}
              >
                <div className="font-medium text-foreground text-base mb-1 truncate">
                  {link.title}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {link.url}
                </div>
              </a>
            ) : (
              <div className="block h-full p-4 bg-background border border-dashed border-border rounded">
                <div className="mb-3">
                  <label className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                    Title
                  </label>
                  <input
                    type="text"
                    value={link.title}
                    onChange={(e) =>
                      handleChange(index, "title", e.target.value)
                    }
                    className="w-full text-sm font-medium text-foreground border-b border-border focus:border-muted-foreground outline-none pb-1 bg-transparent"
                    aria-label={`Title`}
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                    URL
                  </label>
                  <input
                    type="text"
                    value={link.url}
                    onChange={(e) => handleChange(index, "url", e.target.value)}
                    className="w-full text-xs text-foreground border-b border-border focus:border-muted-foreground outline-none pb-1 bg-transparent"
                    aria-label={`URL`}
                  />
                </div>
                <button
                  onClick={() => deleteLink(index)}
                  className="absolute -top-2 -right-2 bg-muted text-muted-foreground border border-border p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:text-destructive hover:border-red-200 dark:hover:border-red-400"
                  aria-label={`Delete ${link.title}`}
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            )}
          </div>
        ))}

        {isEditing && (
          <button
            onClick={addNewLink}
            className="flex flex-col items-center justify-center h-full min-h-[100px] p-4 border border-dashed border-border rounded text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors"
            aria-label="Add new link"
          >
            <svg
              className="w-6 h-6 mb-1"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            <span className="text-xs font-medium">Add Link</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default QuickLinks;
