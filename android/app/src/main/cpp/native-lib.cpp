#include <jni.h>
#include <cstdlib>
#include <cstring>
#include <string>
#include <vector>
#include <pthread.h>
#include <unistd.h>
#include <android/log.h>
#include "node.h"

static const char *TAG = "BlindTestNode";
static int pipe_stdout[2];
static int pipe_stderr[2];

static void *pump(void *arg) {
    int fd = *static_cast<int *>(arg);
    int priority = fd == pipe_stderr[0] ? ANDROID_LOG_ERROR : ANDROID_LOG_INFO;
    char buffer[4096];
    ssize_t size;
    while ((size = read(fd, buffer, sizeof buffer - 1)) > 0) {
        if (buffer[size - 1] == '\n') --size;
        buffer[size] = 0;
        __android_log_write(priority, TAG, buffer);
    }
    return nullptr;
}

static void redirect_output() {
    setvbuf(stdout, nullptr, _IONBF, 0);
    setvbuf(stderr, nullptr, _IONBF, 0);
    pipe(pipe_stdout);
    pipe(pipe_stderr);
    dup2(pipe_stdout[1], STDOUT_FILENO);
    dup2(pipe_stderr[1], STDERR_FILENO);
    pthread_t out_thread;
    pthread_t err_thread;
    pthread_create(&out_thread, nullptr, pump, &pipe_stdout[0]);
    pthread_create(&err_thread, nullptr, pump, &pipe_stderr[0]);
    pthread_detach(out_thread);
    pthread_detach(err_thread);
}

static std::vector<std::string> to_strings(JNIEnv *env, jobjectArray array) {
    std::vector<std::string> result;
    jsize count = env->GetArrayLength(array);
    for (jsize i = 0; i < count; i++) {
        auto item = (jstring) env->GetObjectArrayElement(array, i);
        const char *chars = env->GetStringUTFChars(item, nullptr);
        result.emplace_back(chars);
        env->ReleaseStringUTFChars(item, chars);
        env->DeleteLocalRef(item);
    }
    return result;
}

extern "C" JNIEXPORT jint JNICALL
Java_fr_blindtest_app_NodeRuntime_startNode(JNIEnv *env, jobject, jobjectArray arguments, jobjectArray envKeys, jobjectArray envValues) {
    std::vector<std::string> keys = to_strings(env, envKeys);
    std::vector<std::string> values = to_strings(env, envValues);
    for (size_t i = 0; i < keys.size() && i < values.size(); i++) {
        setenv(keys[i].c_str(), values[i].c_str(), 1);
    }

    std::vector<std::string> args = to_strings(env, arguments);
    size_t total = 0;
    for (const auto &arg : args) total += arg.size() + 1;
    char *buffer = (char *) calloc(total, sizeof(char));
    std::vector<char *> argv;
    char *cursor = buffer;
    for (const auto &arg : args) {
        memcpy(cursor, arg.c_str(), arg.size());
        argv.push_back(cursor);
        cursor += arg.size() + 1;
    }

    redirect_output();
    __android_log_print(ANDROID_LOG_INFO, TAG, "Démarrage de Node avec %zu arguments", args.size());
    int result = node::Start((int) argv.size(), argv.data());
    free(buffer);
    return (jint) result;
}
