import { Clock, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useVersionStore } from '@/store/useVersionStore';
import { useToast } from '@/components/ToastProvider';

const formatTimeAgo = (dateString) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now - date) / 1000);
  
  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  return `${Math.floor(diffInSeconds / 86400)}d ago`;
};

const VersionSidebar = ({ documentId }) => {
  const toast = useToast();
  const { versions, restoreVersion, saving, setPreviewVersion, previewVersionId } = useVersionStore();

  const handleRestore = async (version) => {
    if (window.confirm(`Are you sure you want to restore Version ${version.versionNumber}? This will create a new version.`)) {
      const result = await restoreVersion(documentId, version._id);
      if (result?.saved) {
        toast.success(`Restored from version ${version.versionNumber}`);
      } else {
        toast.info(result?.message || "Restore skipped. No changes detected.");
      }
    }
  };

  const formatAbsoluteTime = (dateString) =>
    new Date(dateString).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });

  const handlePreview = (version) => {
    // If it's the latest version, we reset preview mode. Otherwise we set the preview version id.
    const latestVersionNum = Math.max(...versions.map(v => v.versionNumber));
    if (version.versionNumber === latestVersionNum) {
      setPreviewVersion(null, version.content);
    } else {
      setPreviewVersion(version._id, version.content);
    }
  };

  if (!versions || versions.length === 0) {
    return (
      <div className="w-64 bg-gray-50 border-r border-gray-200 p-4 flex items-center justify-center text-sm text-gray-500">
        No history available.
      </div>
    );
  }

  // The latest version is the highest version number
  const latestVersionNum = Math.max(...versions.map(v => v.versionNumber));

  return (
    <div className="w-64 bg-gray-50 border-r border-gray-200 flex flex-col h-[calc(100vh-65px)]">
      <div className="p-4 border-b border-gray-200 bg-white">
        <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
          <Clock className="w-4 h-4" /> Version History
        </h2>
      </div>
      
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {versions.map((version) => {
          const isLatest = version.versionNumber === latestVersionNum;
          // If we are actively previewing this old version, or it's the latest and we aren't previewing anything
          const isActive = previewVersionId === version._id || (isLatest && previewVersionId === null);
          
          return (
            <div 
              key={version._id} 
              className={`p-3 rounded-lg border transition-all cursor-pointer ${
                 isActive ? 'border-gray-300 bg-gray-100' : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
              onClick={() => handlePreview(version)}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-bold text-gray-800">
                  Version {version.versionNumber}
                </span>
                {isLatest && (
                  <span className="text-[10px] uppercase font-bold text-gray-700 bg-gray-200 px-1.5 py-0.5 rounded">
                    Latest
                  </span>
                )}
              </div>
              <p className="text-[11px] text-gray-700 mb-1 truncate">
                {version.commitMessage || "No commit message"}
              </p>
              <p className="text-xs text-gray-500 mb-3">
                {formatTimeAgo(version.createdAt)}
              </p>
              <p className="text-[11px] text-gray-500 mb-3">
                {formatAbsoluteTime(version.createdAt)}
              </p>
              {version.action === "restore" && (
                <p className="text-[11px] text-gray-600 mb-2">
                  restore from v{version.restoredFromVersionNumber}
                </p>
              )}
              
              {!isLatest && (
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="w-full text-xs h-7"
                  disabled={saving}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRestore(version);
                  }}
                >
                  <RotateCcw className="w-3 h-3 mr-1" /> Restore This
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default VersionSidebar;
