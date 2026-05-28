use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileNode {
    pub name: String,
    pub path: String,
    pub size: u64,
    pub is_dir: bool,
    pub file_type: FileCategory,
    pub children: Option<Vec<FileNode>>,
    pub last_accessed: Option<i64>,
    pub last_modified: Option<i64>,
    pub safety_level: SafetyLevel,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub enum FileCategory {
    System,
    Application,
    Document,
    Media,
    Code,
    DevCache,
    Cache,
    Log,
    Archive,
    Trash,
    Other,
}

impl std::fmt::Display for FileCategory {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            FileCategory::System => write!(f, "System"),
            FileCategory::Application => write!(f, "Application"),
            FileCategory::Document => write!(f, "Document"),
            FileCategory::Media => write!(f, "Media"),
            FileCategory::Code => write!(f, "Code"),
            FileCategory::DevCache => write!(f, "DevCache"),
            FileCategory::Cache => write!(f, "Cache"),
            FileCategory::Log => write!(f, "Log"),
            FileCategory::Archive => write!(f, "Archive"),
            FileCategory::Trash => write!(f, "Trash"),
            FileCategory::Other => write!(f, "Other"),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SafetyLevel {
    Safe,
    Review,
    Caution,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum DevJunkType {
    AppCache,
    AppLogs,
    BrowserCache,
    EditorCache,
    CommunicationCache,
    AICache,
    DiagnosticReports,
    SavedState,
    NodeModules,
    NextCache,
    TurboCache,
    PythonBytecode,
    FlutterCache,
    RustBuild,
    BuildArtifacts,
    XcodeDerivedData,
    XcodeArchives,
    XcodeDeviceSupport,
    IOSSimulators,
    CocoaPodsCache,
    SPMCache,
    GradleCache,
    DockerImages,
    DockerVolumes,
    GitObjects,
    HomebrewCache,
    NpmCache,
    PnpmStore,
    YarnCache,
    BunCache,
    CorepackCache,
    UvCache,
    CondaCache,
    MavenCache,
    GoCache,
    CargoCache,
    PipCache,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DevJunkItem {
    pub path: String,
    pub size: u64,
    pub junk_type: DevJunkType,
    pub project_name: Option<String>,
    pub last_modified: Option<i64>,
    pub safety_level: SafetyLevel,
}
