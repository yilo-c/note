import sys, os
from PyQt6.QtWidgets import QApplication
from PyQt6.QtWebEngineWidgets import QWebEngineView
from PyQt6.QtWebEngineCore import QWebEngineSettings
from PyQt6.QtCore import QUrl

os.chdir(os.path.dirname(os.path.abspath(__file__)))

app = QApplication(sys.argv)
app.setApplicationName("思忆便签")

view = QWebEngineView()
view.setWindowTitle("思忆便签 (开发模式)")
view.resize(340, 680)
view.setMinimumSize(280, 400)

settings = view.page().settings()
settings.setAttribute(QWebEngineSettings.WebAttribute.LocalContentCanAccessRemoteUrls, True)
settings.setAttribute(QWebEngineSettings.WebAttribute.LocalContentCanAccessFileUrls, True)

view.page().load(QUrl("http://localhost:3000"))
view.show()
app.exec()
