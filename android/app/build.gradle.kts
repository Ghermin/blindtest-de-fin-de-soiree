plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

val versionCodeProp = (project.findProperty("versionCode") as String?)?.toIntOrNull() ?: 1
val versionNameProp = (project.findProperty("versionName") as String?) ?: "dev"
val storeFileProp = project.findProperty("storeFile") as String?

android {
    namespace = "fr.blindtest.app"
    compileSdk = 34
    ndkVersion = "26.1.10909125"

    defaultConfig {
        applicationId = "fr.blindtest.app"
        minSdk = 24
        targetSdk = 28
        versionCode = versionCodeProp
        versionName = versionNameProp
        ndk {
            abiFilters += listOf("arm64-v8a")
        }
        externalNativeBuild {
            cmake {
                arguments += listOf("-DANDROID_STL=c++_shared")
            }
        }
    }

    signingConfigs {
        create("release") {
            if (storeFileProp != null) {
                storeFile = file(storeFileProp)
                storePassword = project.findProperty("storePassword") as String?
                keyAlias = project.findProperty("keyAlias") as String?
                keyPassword = project.findProperty("keyPassword") as String?
                storeType = "PKCS12"
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = if (storeFileProp != null) signingConfigs.getByName("release") else signingConfigs.getByName("debug")
        }
    }

    externalNativeBuild {
        cmake {
            path = file("CMakeLists.txt")
            version = "3.22.1"
        }
    }

    sourceSets {
        getByName("main") {
            jniLibs.srcDirs("libnode/bin")
        }
    }

    packaging {
        jniLibs {
            useLegacyPackaging = true
            pickFirsts += listOf("**/libnode.so", "**/libc++_shared.so")
        }
    }

    lint {
        checkReleaseBuilds = false
        abortOnError = false
        disable += listOf("ExpiredTargetSdkVersion")
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("androidx.core:core-ktx:1.13.1")
}
