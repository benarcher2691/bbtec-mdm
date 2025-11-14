plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

import java.io.ByteArrayOutputStream
import java.time.Instant
import java.util.Properties

// ============================================
// BUILD PROVENANCE - Git metadata functions
// ============================================
// These functions inject git metadata into the APK so you can trace
// any production build back to its exact source code.

fun getGitCommitSha(): String {
    return try {
        val stdout = ByteArrayOutputStream()
        exec {
            commandLine("git", "rev-parse", "--short", "HEAD")
            standardOutput = stdout
            isIgnoreExitValue = true
        }
        stdout.toString().trim().ifEmpty { "unknown" }
    } catch (e: Exception) {
        "unknown"
    }
}

fun getGitBranch(): String {
    return try {
        val stdout = ByteArrayOutputStream()
        exec {
            commandLine("git", "rev-parse", "--abbrev-ref", "HEAD")
            standardOutput = stdout
            isIgnoreExitValue = true
        }
        stdout.toString().trim().ifEmpty { "unknown" }
    } catch (e: Exception) {
        "unknown"
    }
}

fun getBuildTimestamp(): String {
    return Instant.now().toString()
}

// ============================================
// KEYSTORE SECURITY - Load credentials safely
// ============================================
// Loads keystore credentials from local file (not in git)
// Falls back to environment variables for CI/CD

val keystorePropertiesFile = rootProject.file("keystore.properties")
val keystoreProperties = Properties()
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(keystorePropertiesFile.inputStream())
}

android {
    namespace = "com.bbtec.mdm.client"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.bbtec.mdm.client"
        minSdk = 29
        targetSdk = 34
        versionCode = 47
        versionName = "0.0.47"

        // BUILD PROVENANCE - Inject git metadata into APK
        // Access these in your app via BuildConfig.GIT_COMMIT_SHA, etc.
        // Critical for tracing production builds back to source code
        buildConfigField("String", "GIT_COMMIT_SHA", "\"${getGitCommitSha()}\"")
        buildConfigField("String", "GIT_BRANCH", "\"${getGitBranch()}\"")
        buildConfigField("String", "BUILD_TIMESTAMP", "\"${getBuildTimestamp()}\"")
    }

    // Product Flavors for different environments
    flavorDimensions += "environment"
    productFlavors {
        create("local") {
            dimension = "environment"
            // Note: No applicationIdSuffix for local - keeps base package name for easier development
            // This means you can't install local + staging/production at the same time
            versionNameSuffix = "-local"
            // localhost works with physical device via adb reverse tcp:3000 tcp:3000
            buildConfigField("String", "BASE_URL", "\"http://localhost:3000/api/client\"")
        }
        create("staging") {
            dimension = "environment"
            applicationIdSuffix = ".staging"
            versionNameSuffix = "-staging"
            // Points to Vercel preview deployment (development branch)
            buildConfigField("String", "BASE_URL", "\"https://bbtec-mdm-git-development.vercel.app/api/client\"")
        }
        create("production") {
            dimension = "environment"
            // Production keeps the original applicationId (no suffix)
            buildConfigField("String", "BASE_URL", "\"https://bbtec-mdm.vercel.app/api/client\"")
        }
    }

    signingConfigs {
        getByName("debug") {
            // Enable both v1 (JAR) and v2 signing for compatibility
            // v1 is needed for parsing code that looks for META-INF/ certificates
            enableV1Signing = true
            enableV2Signing = true
        }
        create("release") {
            // Load credentials from keystore.properties (not in git!)
            // Falls back to environment variables for CI/CD
            storeFile = file(
                keystoreProperties.getProperty("storeFile")
                    ?: System.getenv("KEYSTORE_FILE")
                    ?: "../bbtec-mdm.keystore"
            )
            storePassword = keystoreProperties.getProperty("storePassword")
                ?: System.getenv("KEYSTORE_PASSWORD")
                ?: error("Missing keystore password - create keystore.properties or set KEYSTORE_PASSWORD env var")
            keyAlias = keystoreProperties.getProperty("keyAlias")
                ?: System.getenv("KEY_ALIAS")
                ?: error("Missing key alias - create keystore.properties or set KEY_ALIAS env var")
            keyPassword = keystoreProperties.getProperty("keyPassword")
                ?: System.getenv("KEY_PASSWORD")
                ?: error("Missing key password - create keystore.properties or set KEY_PASSWORD env var")
            enableV1Signing = true
            enableV2Signing = true
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"))
            signingConfig = signingConfigs.getByName("release")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_1_8
        targetCompatibility = JavaVersion.VERSION_1_8
    }

    kotlinOptions {
        jvmTarget = "1.8"
    }

    buildFeatures {
        buildConfig = true  // Enable BuildConfig generation for flavor-specific constants
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.12.0")
    implementation("androidx.appcompat:appcompat:1.6.1")
    implementation("com.google.android.material:material:1.11.0")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("com.google.code.gson:gson:2.10.1")
    implementation("androidx.work:work-runtime-ktx:2.9.0")

    // DataStore for state persistence
    implementation("androidx.datastore:datastore-preferences:1.0.0")

    // Kotlin Coroutines (for WorkManager and DataStore)
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.7.3")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core:1.7.3")
}
