from locust import HttpUser, task, between

class ECGUser(HttpUser):
    wait_time = between(1, 2)  # التوقف من 1 إلى 2 ثانية بين كل طلب

    @task
    def test_predict_image(self):
        # فتح صورة وهمية وإرسالها للسيرفر
        with open("test_ecg.jpg", "rb") as img:
            self.client.post("/ecg/predict-image", files={"file": ("test_ecg.jpg", img, "image/jpeg")})