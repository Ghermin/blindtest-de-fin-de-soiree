package fr.blindtest.app

object NodeRuntime {
    @Volatile
    var started = false

    init {
        System.loadLibrary("node")
        System.loadLibrary("native-lib")
    }

    external fun startNode(arguments: Array<String>, envKeys: Array<String>, envValues: Array<String>): Int
}
