package com.fieldtrace.app;

import android.content.Intent;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Notification;
import android.Manifest;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.Color;
import android.net.Uri;
import android.content.ContentUris;
import android.database.Cursor;
import android.media.MediaExtractor;
import android.media.MediaFormat;
import android.provider.MediaStore;
import android.os.Bundle;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.PermissionRequest;
import android.view.Gravity;
import android.view.ViewGroup;
import android.widget.FrameLayout;
import android.widget.ImageView;
import androidx.core.splashscreen.SplashScreen;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebChromeClient;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.util.ArrayList;
import android.content.ContentValues;
import android.os.Build;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.graphics.Paint;
import android.graphics.Typeface;
import android.graphics.RectF;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Collections;
import java.util.Date;
import java.util.Locale;
import java.text.SimpleDateFormat;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import androidx.media3.common.MediaItem;
import androidx.media3.common.MimeTypes;
import androidx.media3.common.util.UnstableApi;
import androidx.media3.effect.CanvasOverlay;
import androidx.media3.effect.OverlayEffect;
import androidx.media3.transformer.EditedMediaItem;
import androidx.media3.transformer.Effects;
import androidx.media3.transformer.ExportException;
import androidx.media3.transformer.ExportResult;
import androidx.media3.transformer.Transformer;


public class MainActivity extends BridgeActivity {
  private static final String ALBUM_NAME = "Field Trace";

  @Override
  public void onCreate(Bundle savedInstanceState) {
    SplashScreen.installSplashScreen(this);
    super.onCreate(savedInstanceState);
    showFieldTraceLaunchSplash();
    applyCameraWebViewFixes();
    refreshNativeWebAssetsIfVersionChanged();
    requestDownloadNotificationPermission();
    requestCameraPermission();
  }

  @Override
  public void onStart() {
    super.onStart();
    applyCameraWebViewFixes();
  }

  @Override
  public void onResume() {
    super.onResume();
    applyCameraWebViewFixes();
  }

  /**
   * Android 12+ always renders a system splash first and masks its icon.
   * We intentionally keep that system splash visually blank/white and then
   * render the complete FieldTrace artwork as a short in-app launch overlay.
   * This is the only way to get the requested full white canvas + complete
   * logo without the system icon mask clipping the rounded logo.
   */
  private void showFieldTraceLaunchSplash() {
    try {
      final ViewGroup decor = (ViewGroup) getWindow().getDecorView();
      final FrameLayout overlay = new FrameLayout(this);
      overlay.setBackgroundColor(Color.WHITE);
      overlay.setTag("FieldTraceLaunchSplash");

      final ImageView logo = new ImageView(this);
      logo.setImageResource(com.fieldtrace.app.R.drawable.splash_icon);
      logo.setScaleType(ImageView.ScaleType.CENTER_INSIDE);
      logo.setAdjustViewBounds(false);

      FrameLayout.LayoutParams logoParams = new FrameLayout.LayoutParams(
          ViewGroup.LayoutParams.MATCH_PARENT,
          ViewGroup.LayoutParams.MATCH_PARENT
      );
      logoParams.gravity = Gravity.CENTER;
      overlay.addView(logo, logoParams);

      decor.addView(
          overlay,
          new ViewGroup.LayoutParams(
              ViewGroup.LayoutParams.MATCH_PARENT,
              ViewGroup.LayoutParams.MATCH_PARENT
          )
      );

      overlay.postDelayed(() -> {
        try {
          overlay.animate()
              .alpha(0f)
              .setDuration(140L)
              .withEndAction(() -> {
                try {
                  decor.removeView(overlay);
                } catch (Exception ignored) {}
              })
              .start();
        } catch (Exception ignored) {
          try { decor.removeView(overlay); } catch (Exception ignored2) {}
        }
      }, 650L);
    } catch (Exception ignored) {}
  }

  private void refreshNativeWebAssetsIfVersionChanged() {
    try {
      android.content.SharedPreferences prefs = getSharedPreferences("fieldtrace_native_cache", MODE_PRIVATE);
      int currentVersion = 5;
      int storedVersion = prefs.getInt("web_asset_version", -1);
      if (storedVersion == currentVersion) return;

      if (this.bridge != null && this.bridge.getWebView() != null) {
        WebView webView = this.bridge.getWebView();
        webView.clearCache(true);
        webView.getSettings().setCacheMode(WebSettings.LOAD_NO_CACHE);
        webView.postDelayed(() -> {
          try {
            webView.evaluateJavascript(
                "(async()=>{try{if('serviceWorker' in navigator){const rs=await navigator.serviceWorker.getRegistrations();await Promise.all(rs.map(r=>r.unregister()));}if(window.caches){const ks=await caches.keys();await Promise.all(ks.map(k=>caches.delete(k)));}}catch(e){console.warn('[FieldTrace] cache refresh',e)}})()",
                value -> {
                  try {
                    webView.reload();
                  } catch (Exception ignored) {}
                }
            );
          } catch (Exception ignored) {
            try { webView.reload(); } catch (Exception ignored2) {}
          }
        }, 350L);
      }

      prefs.edit().putInt("web_asset_version", currentVersion).apply();
    } catch (Exception ignored) {}
  }

  private void applyCameraWebViewFixes() {
    try {
      if (this.bridge == null) return;
      WebView webView = this.bridge.getWebView();
      if (webView == null) return;
      WebSettings settings = webView.getSettings();
      settings.setMediaPlaybackRequiresUserGesture(false);
      settings.setDomStorageEnabled(true);
      settings.setJavaScriptEnabled(true);
      webView.setBackgroundColor(Color.TRANSPARENT);
      webView.getRootView().setBackgroundColor(Color.BLACK);
      if (getWindow() != null && getWindow().getDecorView() != null) {
        getWindow().getDecorView().setBackgroundColor(Color.BLACK);
      }
      webView.setLayerType(WebView.LAYER_TYPE_HARDWARE, null);
      try {
        webView.addJavascriptInterface(new FieldTraceBridge(), "FieldTraceNative");
      } catch (Exception ignored) {}
      webView.setWebChromeClient(new BridgeWebChromeClient(this.bridge) {
        @Override
        public Bitmap getDefaultVideoPoster() {
          Bitmap bitmap = Bitmap.createBitmap(1, 1, Bitmap.Config.ARGB_8888);
          Canvas canvas = new Canvas(bitmap);
          canvas.drawARGB(0, 0, 0, 0);
          return bitmap;
        }

        @Override
        public void onPermissionRequest(final PermissionRequest request) {
          // Permitir getUserMedia dentro del WebView de Field Trace.
          // El acceso sigue limitado al WebView de la propia app; no se expone
          // ningún permiso a una página externa.
          runOnUiThread(() -> {
            try {
              if (request != null) {
                request.grant(request.getResources());
              }
            } catch (Exception error) {
              try { request.deny(); } catch (Exception ignored) {}
            }
          });
        }
      });
      webView.post(() -> {
        try {
          webView.getSettings().setMediaPlaybackRequiresUserGesture(false);
        } catch (Exception ignored) {}
      });
    } catch (Exception ignored) {}
  }

  private void requestCameraPermission() {
    try {
      if (checkSelfPermission(Manifest.permission.CAMERA) != android.content.pm.PackageManager.PERMISSION_GRANTED) {
        requestPermissions(new String[]{Manifest.permission.CAMERA}, 9102);
      }
    } catch (Exception ignored) {}
  }

  @Override
  public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
    super.onRequestPermissionsResult(requestCode, permissions, grantResults);
    if (requestCode == 9102) {
      try {
        WebView webView = this.bridge == null ? null : this.bridge.getWebView();
        if (webView != null) {
          webView.post(() -> webView.evaluateJavascript(
              "window.dispatchEvent(new Event('fieldtrace-camera-permission'));",
              null
          ));
        }
      } catch (Exception ignored) {}
    }
  }

  private void requestDownloadNotificationPermission() {
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
          checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != android.content.pm.PackageManager.PERMISSION_GRANTED) {
        requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 9101);
      }
    } catch (Exception ignored) {}
  }

  public class FieldTraceBridge {
    @JavascriptInterface
    public void openUri(String uriString) {
      if (uriString == null || uriString.trim().isEmpty()) {
        openFieldTraceAlbum();
        return;
      }
      try {
        Uri uri = resolveImageContentUri(uriString.trim());
        Intent intent = new Intent(Intent.ACTION_VIEW);
        intent.setDataAndType(uri, "image/*");
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        startActivity(intent);
      } catch (Exception e1) {
        try {
          Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(uriString.trim()));
          intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
          intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
          startActivity(intent);
        } catch (Exception e2) {
          openFieldTraceAlbum();
        }
      }
    }

    private Uri resolveImageContentUri(String uriString) {
      Uri parsed = Uri.parse(uriString);
      if ("content".equalsIgnoreCase(parsed.getScheme())) return parsed;
      String path = "file".equalsIgnoreCase(parsed.getScheme()) ? parsed.getPath() : uriString;
      String[] projection = { MediaStore.Images.Media._ID, MediaStore.Images.Media.DATA };
      try (Cursor cursor = getContentResolver().query(
          MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
          projection,
          MediaStore.Images.Media.DATA + "=?",
          new String[]{ path },
          null)) {
        if (cursor != null && cursor.moveToFirst()) {
          long id = cursor.getLong(cursor.getColumnIndexOrThrow(MediaStore.Images.Media._ID));
          return ContentUris.withAppendedId(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, id);
        }
      }
      throw new IllegalArgumentException("Image not found in MediaStore: " + path);
    }

    @JavascriptInterface
    public void openGallery() { openFieldTraceAlbum(); }

    @JavascriptInterface
    public void openFieldTraceAlbum() {
      try {
        String latest = getLatestFieldTracePhotoUri();
        if (latest != null && !latest.isEmpty()) {
          Uri uri = Uri.parse(latest);
          Intent intent = new Intent(Intent.ACTION_VIEW);
          intent.setDataAndType(uri, "image/*");
          intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
          intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
          startActivity(intent);
          return;
        }
      } catch (Exception ignored) {}
      try {
        Intent intent = new Intent(Intent.ACTION_VIEW);
        intent.setDataAndType(Uri.parse("content://media/external/images/media"), "image/*");
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        startActivity(intent);
        return;
      } catch (Exception ignored) {}
      try {
        Intent intent = new Intent(Intent.ACTION_MAIN);
        intent.addCategory(Intent.CATEGORY_APP_GALLERY);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        startActivity(intent);
        return;
      } catch (Exception ignored) {}
      try {
        Intent intent = new Intent(Intent.ACTION_VIEW);
        intent.setType("image/*");
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        startActivity(intent);
      } catch (Exception ignored) {}
    }

    @JavascriptInterface
    public String getLatestFieldTracePhotoUri() {
      try {
        String[] projection = {
          MediaStore.Images.Media._ID,
          MediaStore.Images.Media.BUCKET_DISPLAY_NAME,
          MediaStore.Images.Media.DATE_ADDED
        };
        try (Cursor cursor = getContentResolver().query(
            MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
            projection,
            MediaStore.Images.Media.BUCKET_DISPLAY_NAME + "=?",
            new String[]{ ALBUM_NAME },
            MediaStore.Images.Media.DATE_ADDED + " DESC")) {
          if (cursor != null && cursor.moveToFirst()) {
            long id = cursor.getLong(cursor.getColumnIndexOrThrow(MediaStore.Images.Media._ID));
            return ContentUris.withAppendedId(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, id).toString();
          }
        }
        try (Cursor cursor = getContentResolver().query(
            MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
            new String[]{ MediaStore.Images.Media._ID, MediaStore.Images.Media.DATA },
            MediaStore.Images.Media.DATA + " LIKE ? OR " + MediaStore.Images.Media.DATA + " LIKE ?",
            new String[]{ "%/Field Trace/%", "%/FieldTrace/%" },
            MediaStore.Images.Media.DATE_ADDED + " DESC")) {
          if (cursor != null && cursor.moveToFirst()) {
            long id = cursor.getLong(cursor.getColumnIndexOrThrow(MediaStore.Images.Media._ID));
            return ContentUris.withAppendedId(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, id).toString();
          }
        }
      } catch (Exception ignored) {}
      return "";
    }

    @JavascriptInterface
    public String listFieldTracePhotos(int limit) {
      JSONArray arr = new JSONArray();
      if (limit <= 0) limit = 60;
      if (limit > 200) limit = 200;
      try {
        String[] projection = {
          MediaStore.Images.Media._ID,
          MediaStore.Images.Media.BUCKET_DISPLAY_NAME,
          MediaStore.Images.Media.DATE_ADDED
        };
        try (Cursor cursor = getContentResolver().query(
            MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
            projection,
            MediaStore.Images.Media.BUCKET_DISPLAY_NAME + "=?",
            new String[]{ ALBUM_NAME },
            MediaStore.Images.Media.DATE_ADDED + " DESC")) {
          if (cursor != null) {
            int n = 0;
            while (cursor.moveToNext() && n < limit) {
              long id = cursor.getLong(cursor.getColumnIndexOrThrow(MediaStore.Images.Media._ID));
              String uri = ContentUris.withAppendedId(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, id).toString();
              JSONObject obj = new JSONObject();
              obj.put("uri", uri);
              obj.put("id", id);
              arr.put(obj);
              n++;
            }
          }
        }
        if (arr.length() == 0) {
          try (Cursor cursor = getContentResolver().query(
              MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
              new String[]{ MediaStore.Images.Media._ID, MediaStore.Images.Media.DATA },
              MediaStore.Images.Media.DATA + " LIKE ? OR " + MediaStore.Images.Media.DATA + " LIKE ?",
              new String[]{ "%/Field Trace/%", "%/FieldTrace/%" },
              MediaStore.Images.Media.DATE_ADDED + " DESC")) {
            if (cursor != null) {
              int n = 0;
              while (cursor.moveToNext() && n < limit) {
                long id = cursor.getLong(cursor.getColumnIndexOrThrow(MediaStore.Images.Media._ID));
                String uri = ContentUris.withAppendedId(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, id).toString();
                JSONObject obj = new JSONObject();
                obj.put("uri", uri);
                obj.put("id", id);
                arr.put(obj);
                n++;
              }
            }
          }
        }
      } catch (Exception ignored) {}
      return arr.toString();
    }

    @JavascriptInterface
    public String getPhotoThumbnailBase64(String uriString, int maxSide) {
      if (uriString == null || uriString.trim().isEmpty()) return "";
      if (maxSide <= 0) maxSide = 256;
      if (maxSide > 2048) maxSide = 2048;
      try {
        Uri uri = Uri.parse(uriString.trim());
        if (!"content".equalsIgnoreCase(uri.getScheme()) && !"file".equalsIgnoreCase(uri.getScheme())) {
          try { uri = resolveImageContentUri(uriString.trim()); } catch (Exception e) { uri = Uri.parse(uriString.trim()); }
        }
        BitmapFactory.Options bounds = new BitmapFactory.Options();
        bounds.inJustDecodeBounds = true;
        try (InputStream is = getContentResolver().openInputStream(uri)) {
          if (is == null) return "";
          BitmapFactory.decodeStream(is, null, bounds);
        }
        int sample = 1;
        int w = Math.max(1, bounds.outWidth);
        int h = Math.max(1, bounds.outHeight);
        while (Math.max(w / sample, h / sample) > maxSide) sample *= 2;
        BitmapFactory.Options opts = new BitmapFactory.Options();
        opts.inSampleSize = sample;
        Bitmap bmp;
        try (InputStream is = getContentResolver().openInputStream(uri)) {
          if (is == null) return "";
          bmp = BitmapFactory.decodeStream(is, null, opts);
        }
        if (bmp == null) return "";
        int tw = bmp.getWidth();
        int th = bmp.getHeight();
        float scale = Math.min(1f, (float) maxSide / Math.max(tw, th));
        if (scale < 0.99f) {
          Bitmap scaled = Bitmap.createScaledBitmap(bmp, Math.round(tw * scale), Math.round(th * scale), true);
          if (scaled != bmp) { bmp.recycle(); bmp = scaled; }
        }
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        int quality = maxSide > 512 ? 85 : 72;
        bmp.compress(Bitmap.CompressFormat.JPEG, quality, baos);
        bmp.recycle();
        return "data:image/jpeg;base64," + Base64.encodeToString(baos.toByteArray(), Base64.NO_WRAP);
      } catch (Exception e) { return ""; }
    }

    @JavascriptInterface
    public String getLatestFieldTraceThumbnailBase64(int maxSide) {
      try {
        String uri = getLatestFieldTracePhotoUri();
        if (uri == null || uri.isEmpty()) return "";
        return getPhotoThumbnailBase64(uri, maxSide);
      } catch (Exception e) { return ""; }
    }

    @JavascriptInterface
    public int deleteUris(String urisJson) {
      int deleted = 0;
      if (urisJson == null || urisJson.trim().isEmpty()) return 0;
      try {
        JSONArray arr = new JSONArray(urisJson);
        for (int i = 0; i < arr.length(); i++) {
          String s = arr.optString(i, "");
          if (s.isEmpty()) continue;
          try { int n = getContentResolver().delete(Uri.parse(s), null, null); if (n > 0) deleted += n; } catch (Exception ignored) {}
        }
      } catch (Exception ignored) {}
      return deleted;
    }

    @JavascriptInterface
    public int deleteUri(String uriString) {
      if (uriString == null || uriString.trim().isEmpty()) return 0;
      try { return getContentResolver().delete(Uri.parse(uriString.trim()), null, null); } catch (Exception e) { return 0; }
    }

    @JavascriptInterface
    public void shareUris(String urisJson) {
      if (urisJson == null || urisJson.trim().isEmpty()) return;
      try {
        JSONArray arr = new JSONArray(urisJson);
        ArrayList<Uri> uris = new ArrayList<>();
        for (int i = 0; i < arr.length(); i++) {
          String s = arr.optString(i, "");
          if (s.isEmpty()) continue;
          try { uris.add(Uri.parse(s)); } catch (Exception ignored) {}
        }
        if (uris.isEmpty()) return;
        Intent intent;
        if (uris.size() == 1) {
          intent = new Intent(Intent.ACTION_SEND);
          intent.setType("image/jpeg");
          intent.putExtra(Intent.EXTRA_STREAM, uris.get(0));
        } else {
          intent = new Intent(Intent.ACTION_SEND_MULTIPLE);
          intent.setType("image/jpeg");
          intent.putParcelableArrayListExtra(Intent.EXTRA_STREAM, uris);
        }
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        Intent chooser = Intent.createChooser(intent, "Compartir fotos Field Trace");
        chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        startActivity(chooser);
      } catch (Exception ignored) {}
    }
    @JavascriptInterface
    public String composeVideoWithOverlay(String inputPath, String overlayJson) {
      if (inputPath == null || inputPath.trim().isEmpty()) return "";
      final File input = resolveVideoFile(inputPath.trim());
      if (input == null || !input.isFile() || input.length() == 0) {
        android.util.Log.e("FieldTraceVideo", "Input video missing: " + inputPath);
        return "";
      }
      final File output = new File(getCacheDir(), "FT_overlay_" + System.currentTimeMillis() + ".mp4");
      final CountDownLatch latch = new CountDownLatch(1);
      final String[] result = new String[]{""};
      final String[] error = new String[]{""};
      Runnable work = () -> {
        try {
          VideoMetadataOverlay overlay = new VideoMetadataOverlay(new JSONObject(overlayJson == null ? "{}" : overlayJson));
          MediaItem item = MediaItem.fromUri(Uri.fromFile(input));
          EditedMediaItem edited = new EditedMediaItem.Builder(item)
              .setRemoveAudio(false)
              .setEffects(new Effects(Collections.emptyList(), Collections.singletonList(
                  new OverlayEffect(Collections.singletonList(overlay)))))
              .build();

          // Media3 Transformer must be accessed from one application thread.
          // Run the Transformer lifecycle on Android's main application thread,
          // while this JS bridge method waits on its own bridge thread.
          Transformer transformer = new Transformer.Builder(MainActivity.this)
              .setVideoMimeType(MimeTypes.VIDEO_H264)
              .setAudioMimeType(MimeTypes.AUDIO_AAC)
              .addListener(new Transformer.Listener() {
                @Override public void onCompleted(androidx.media3.transformer.Composition c, ExportResult r) {
                  result[0] = output.getAbsolutePath();
                  android.util.Log.d("FieldTraceVideo", "Overlay export completed: " + result[0]);
                  latch.countDown();
                }
                @Override public void onError(androidx.media3.transformer.Composition c, ExportResult r, ExportException e) {
                  error[0] = e == null ? "VIDEO_TRANSFORM_ERROR" : String.valueOf(e.getMessage());
                  android.util.Log.e("FieldTraceVideo", "Overlay export error: " + error[0], e);
                  latch.countDown();
                }
              }).build();
          transformer.start(edited, output.getAbsolutePath());
        } catch (Exception e) {
          error[0] = String.valueOf(e.getMessage());
          android.util.Log.e("FieldTraceVideo", "Overlay setup failed", e);
          latch.countDown();
        }
      };
      try {
        Handler mainHandler = new Handler(Looper.getMainLooper());
        mainHandler.post(work);
        if (!latch.await(180, TimeUnit.SECONDS)) error[0] = "VIDEO_TRANSFORM_TIMEOUT";
      } catch (InterruptedException e) { Thread.currentThread().interrupt(); error[0] = "VIDEO_TRANSFORM_INTERRUPTED"; }
      if (result[0].isEmpty() || !new File(result[0]).isFile()) {
        try { if (output.exists()) output.delete(); } catch (Exception ignored) {}
        android.util.Log.e("FieldTraceVideo", "Overlay transform failed: " + error[0]);
        return "";
      }
      return result[0];
    }

    @JavascriptInterface
    public String getVideoFileInfo(String videoPath) {
      try {
        if (videoPath == null || videoPath.trim().isEmpty()) return "{}";
        File file = resolveVideoFile(videoPath.trim());
        if (file == null) return "{\"exists\":false}";
        JSONObject info = new JSONObject();
        info.put("exists", file.isFile() && file.length() > 0);
        info.put("size", file.length());
        info.put("path", file.getAbsolutePath());
        info.put("audioTracks", countAudioTracks(file));
        return info.toString();
      } catch (Exception e) {
        try {
          JSONObject error = new JSONObject();
          error.put("exists", false);
          error.put("error", String.valueOf(e.getMessage()));
          return error.toString();
        } catch (Exception ignored) {
          return "{\"exists\":false}";
        }
      }
    }

    private int countAudioTracks(File file) {
      if (file == null || !file.isFile() || file.length() <= 0) return 0;
      MediaExtractor extractor = new MediaExtractor();
      int audioTracks = 0;
      try {
        extractor.setDataSource(file.getAbsolutePath());
        int trackCount = extractor.getTrackCount();
        for (int i = 0; i < trackCount; i++) {
          MediaFormat format = extractor.getTrackFormat(i);
          String mime = format.getString(MediaFormat.KEY_MIME);
          if (mime != null && mime.startsWith("audio/")) audioTracks++;
        }
      } catch (Exception e) {
        android.util.Log.w("FieldTraceVideo", "Could not inspect audio tracks: " + e.getMessage());
      } finally {
        try { extractor.release(); } catch (Exception ignored) {}
      }
      return audioTracks;
    }

    private File resolveVideoFile(String path) {
      try {
        if (path == null || path.trim().isEmpty()) return null;
        String value = path.trim();
        if (value.startsWith("file://")) {
          Uri uri = Uri.parse(value);
          String decodedPath = uri.getPath();
          return decodedPath == null ? null : new File(decodedPath);
        }
        if (value.startsWith("content://")) return null;
        return new File(value);
      } catch (Exception e) {
        return null;
      }
    }

    @JavascriptInterface
    public String savePdfToDownloads(String base64Data, String fileName) {
      if (base64Data == null || base64Data.trim().isEmpty()) return "";
      String safeName = fileName == null || fileName.trim().isEmpty() ? "FieldTrace_Report.pdf" : fileName.trim();
      if (!safeName.toLowerCase(Locale.US).endsWith(".pdf")) safeName += ".pdf";
      try {
        byte[] bytes = Base64.decode(base64Data, Base64.DEFAULT);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
          ContentValues values = new ContentValues();
          values.put(MediaStore.Downloads.DISPLAY_NAME, safeName);
          values.put(MediaStore.Downloads.MIME_TYPE, "application/pdf");
          values.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/" + ALBUM_NAME + "/");
          values.put(MediaStore.Downloads.IS_PENDING, 1);
          Uri uri = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
          if (uri == null) return "";
          try (java.io.OutputStream out = getContentResolver().openOutputStream(uri)) {
            if (out == null) throw new IllegalStateException("PDF_OUTPUT_STREAM_NULL");
            out.write(bytes);
            out.flush();
          } catch (Exception copyError) {
            try { getContentResolver().delete(uri, null, null); } catch (Exception ignored) {}
            throw copyError;
          }
          ContentValues published = new ContentValues();
          published.put(MediaStore.Downloads.IS_PENDING, 0);
          getContentResolver().update(uri, published, null, null);
          notifyFileDownload("PDF descargado", safeName, uri, "application/pdf");
          return uri.toString();
        }
        File dir = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS), ALBUM_NAME);
        if (!dir.exists() && !dir.mkdirs()) return "";
        File destination = new File(dir, safeName);
        try (FileOutputStream out = new FileOutputStream(destination)) {
          out.write(bytes);
          out.flush();
        }
        Intent scan = new Intent(Intent.ACTION_MEDIA_SCANNER_SCAN_FILE);
        scan.setData(Uri.fromFile(destination));
        sendBroadcast(scan);
        notifyFileDownload("PDF descargado", safeName, Uri.fromFile(destination), "application/pdf");
        return destination.getAbsolutePath();
      } catch (Exception e) {
        android.util.Log.e("FieldTracePDF", "Save PDF failed", e);
        return "";
      }
    }

    /**
     * Downloads Firebase Storage image URLs directly from Android. A WebView
     * fetch() may be blocked by browser CORS even when the image is valid;
     * the APK cannot use the Netlify function because its origin is local.
     *
     * Only HTTPS Firebase/Google Storage hosts and image bytes are accepted.
     * The byte limit avoids returning an unbounded Base64 string to JavaScript.
     */
    @JavascriptInterface
    public String fetchImageDataUrl(String imageUrl) {
      if (imageUrl == null || imageUrl.trim().isEmpty()) return "";
      HttpURLConnection connection = null;
      try {
        URL current = new URL(imageUrl.trim());
        final long maxBytes = 25L * 1024L * 1024L;

        for (int redirects = 0; redirects <= 3; redirects++) {
          String host = current.getHost() == null ? "" : current.getHost().toLowerCase(Locale.US);
          // Firebase projects may issue download URLs from the legacy
          // firebasestorage.googleapis.com endpoint or the newer bucket-specific
          // firebasestorage.app domain. Google Cloud Storage can also redirect
          // to storage.googleapis.com. Accept only these exact trusted suffixes.
          boolean allowedHost = "firebasestorage.googleapis.com".equals(host) ||
              "storage.googleapis.com".equals(host) ||
              (host.endsWith(".firebasestorage.app") && host.length() > ".firebasestorage.app".length()) ||
              (host.endsWith(".appspot.com") && host.length() > ".appspot.com".length());
          if (!"https".equalsIgnoreCase(current.getProtocol()) || !allowedHost ||
              current.getUserInfo() != null) {
            throw new IllegalArgumentException("Host de fotografía no permitido");
          }

          connection = (HttpURLConnection) current.openConnection();
          connection.setConnectTimeout(15000);
          connection.setReadTimeout(25000);
          connection.setInstanceFollowRedirects(false);
          connection.setRequestMethod("GET");
          connection.setRequestProperty("Accept", "image/jpeg,image/png,image/webp");
          connection.setRequestProperty("Cache-Control", "no-cache");

          int status = connection.getResponseCode();
          if (status == HttpURLConnection.HTTP_MOVED_PERM ||
              status == HttpURLConnection.HTTP_MOVED_TEMP ||
              status == HttpURLConnection.HTTP_SEE_OTHER ||
              status == 307 || status == 308) {
            String location = connection.getHeaderField("Location");
            connection.disconnect();
            connection = null;
            if (location == null || location.trim().isEmpty()) {
              throw new IllegalStateException("Redirección sin destino");
            }
            current = new URL(current, location);
            continue;
          }

          if (status != HttpURLConnection.HTTP_OK) {
            throw new IllegalStateException("HTTP " + status + " al descargar fotografía");
          }

          int contentLength = connection.getContentLength();
          if (contentLength > maxBytes) {
            throw new IllegalStateException("Fotografía excede el límite de 25 MB");
          }

          byte[] bytes;
          try (InputStream input = connection.getInputStream();
               ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            byte[] chunk = new byte[32 * 1024];
            int count;
            while ((count = input.read(chunk)) != -1) {
              if ((long) output.size() + count > maxBytes) {
                throw new IllegalStateException("Fotografía excede el límite de 25 MB");
              }
              output.write(chunk, 0, count);
            }
            bytes = output.toByteArray();
          }

          boolean jpeg = bytes.length >= 3 &&
              (bytes[0] & 0xff) == 0xff &&
              (bytes[1] & 0xff) == 0xd8 &&
              (bytes[2] & 0xff) == 0xff;
          boolean png = bytes.length >= 8 &&
              (bytes[0] & 0xff) == 0x89 && bytes[1] == 0x50 &&
              bytes[2] == 0x4e && bytes[3] == 0x47 &&
              bytes[4] == 0x0d && bytes[5] == 0x0a &&
              bytes[6] == 0x1a && bytes[7] == 0x0a;
          boolean webp = bytes.length >= 12 &&
              bytes[0] == 0x52 && bytes[1] == 0x49 &&
              bytes[2] == 0x46 && bytes[3] == 0x46 &&
              bytes[8] == 0x57 && bytes[9] == 0x45 &&
              bytes[10] == 0x42 && bytes[11] == 0x50;
          if (!jpeg && !png && !webp) {
            throw new IllegalStateException("La respuesta no contiene una imagen compatible");
          }

          String mime = png ? "image/png" : jpeg ? "image/jpeg" : "image/webp";
          return "data:" + mime + ";base64," + Base64.encodeToString(bytes, Base64.NO_WRAP);
        }
        throw new IllegalStateException("Demasiadas redirecciones al descargar fotografía");
      } catch (Exception error) {
        android.util.Log.w("FieldTraceImage", "Descarga nativa de imagen falló: " +
            error.getClass().getSimpleName() + " - " + String.valueOf(error.getMessage()));
        return "";
      } finally {
        if (connection != null) connection.disconnect();
      }
    }

    private File documentSaveTempFile;
    private FileOutputStream documentSaveOutput;
    private String documentSaveName;
    private String documentSaveMime;
    private String documentSaveNotification;

    @JavascriptInterface
    public synchronized String beginDocumentSave(String fileName, String mimeType) {
      try {
        if (documentSaveOutput != null) {
          try { documentSaveOutput.close(); } catch (Exception ignored) {}
        }
        if (documentSaveTempFile != null) {
          try { documentSaveTempFile.delete(); } catch (Exception ignored) {}
        }
        File dir = new File(getCacheDir(), "generated-documents");
        if (!dir.exists() && !dir.mkdirs()) return "";
        documentSaveTempFile = File.createTempFile("fieldtrace-", ".tmp", dir);
        documentSaveOutput = new FileOutputStream(documentSaveTempFile, false);
        documentSaveName = fileName == null || fileName.trim().isEmpty() ? "FieldTrace_Report.bin" : fileName.trim();
        documentSaveName = documentSaveName.replaceAll("[\\\\/:*?\"<>|]+", "_");
        documentSaveMime = mimeType == null || mimeType.trim().isEmpty() ? "application/octet-stream" : mimeType.trim();
        documentSaveNotification = documentSaveMime.contains("zip") ? "ZIP de fotografías descargado" : "Excel descargado";
        return "READY";
      } catch (Exception e) {
        android.util.Log.e("FieldTraceDownload", "Begin chunked document save failed", e);
        cleanupDocumentSave();
        return "";
      }
    }

    @JavascriptInterface
    public synchronized String appendDocumentSaveChunk(String base64Chunk) {
      try {
        if (documentSaveOutput == null || base64Chunk == null) return "";
        byte[] bytes = Base64.decode(base64Chunk, Base64.DEFAULT);
        documentSaveOutput.write(bytes);
        return "OK";
      } catch (Exception e) {
        android.util.Log.e("FieldTraceDownload", "Append chunk failed", e);
        cleanupDocumentSave();
        return "";
      }
    }

    @JavascriptInterface
    public synchronized String finishDocumentSave() {
      File temp = documentSaveTempFile;
      String name = documentSaveName;
      String mime = documentSaveMime;
      String notification = documentSaveNotification;
      try {
        if (documentSaveOutput == null || temp == null) return "";
        documentSaveOutput.flush();
        documentSaveOutput.close();
        documentSaveOutput = null;
        Uri savedUri = null;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
          ContentValues values = new ContentValues();
          values.put(MediaStore.Downloads.DISPLAY_NAME, name);
          values.put(MediaStore.Downloads.MIME_TYPE, mime);
          values.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/" + ALBUM_NAME + "/");
          values.put(MediaStore.Downloads.IS_PENDING, 1);
          savedUri = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
          if (savedUri == null) throw new IllegalStateException("No se pudo crear el archivo en Descargas.");
          try (InputStream in = new FileInputStream(temp); java.io.OutputStream out = getContentResolver().openOutputStream(savedUri)) {
            if (out == null) throw new IllegalStateException("DOCUMENT_OUTPUT_STREAM_NULL");
            byte[] buffer = new byte[64 * 1024];
            int count;
            while ((count = in.read(buffer)) != -1) out.write(buffer, 0, count);
            out.flush();
          }
          ContentValues published = new ContentValues();
          published.put(MediaStore.Downloads.IS_PENDING, 0);
          getContentResolver().update(savedUri, published, null, null);
        } else {
          File dir = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS), ALBUM_NAME);
          if (!dir.exists() && !dir.mkdirs()) throw new IllegalStateException("No se pudo crear la carpeta Descargas.");
          File destination = new File(dir, name);
          try (InputStream in = new FileInputStream(temp); FileOutputStream out = new FileOutputStream(destination)) {
            byte[] buffer = new byte[64 * 1024];
            int count;
            while ((count = in.read(buffer)) != -1) out.write(buffer, 0, count);
            out.flush();
          }
          savedUri = Uri.fromFile(destination);
          Intent scan = new Intent(Intent.ACTION_MEDIA_SCANNER_SCAN_FILE);
          scan.setData(savedUri);
          sendBroadcast(scan);
        }
        notifyFileDownload(notification, name, savedUri, mime);
        return savedUri == null ? "" : savedUri.toString();
      } catch (Exception e) {
        android.util.Log.e("FieldTraceDownload", "Finish chunked document save failed", e);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
          // Remove incomplete pending MediaStore item if one was created.
        }
        return "";
      } finally {
        cleanupDocumentSave();
      }
    }

    @JavascriptInterface
    public synchronized void cancelDocumentSave() {
      cleanupDocumentSave();
    }

    private synchronized void cleanupDocumentSave() {
      try { if (documentSaveOutput != null) documentSaveOutput.close(); } catch (Exception ignored) {}
      documentSaveOutput = null;
      try { if (documentSaveTempFile != null) documentSaveTempFile.delete(); } catch (Exception ignored) {}
      documentSaveTempFile = null;
      documentSaveName = null;
      documentSaveMime = null;
      documentSaveNotification = null;
    }

    @JavascriptInterface
    public String saveExcelToDownloads(String base64Data, String fileName) {
      return saveDocumentToDownloads(base64Data, fileName,
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Excel descargado");
    }

    @JavascriptInterface
    public String saveZipToDownloads(String base64Data, String fileName) {
      return saveDocumentToDownloads(base64Data, fileName,
          "application/zip", "ZIP de fotografías descargado");
    }

    private String saveDocumentToDownloads(String base64Data, String fileName, String mimeType, String notificationTitle) {
      if (base64Data == null || base64Data.trim().isEmpty()) return "";
      String safeName = fileName == null || fileName.trim().isEmpty() ? "FieldTrace_Report.xlsx" : fileName.trim();
      safeName = safeName.replaceAll("[\\\\/:*?\"<>|]+", "_");
      try {
        byte[] bytes = Base64.decode(base64Data, Base64.DEFAULT);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
          ContentValues values = new ContentValues();
          values.put(MediaStore.Downloads.DISPLAY_NAME, safeName);
          values.put(MediaStore.Downloads.MIME_TYPE, mimeType);
          values.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/" + ALBUM_NAME + "/");
          values.put(MediaStore.Downloads.IS_PENDING, 1);
          Uri uri = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
          if (uri == null) return "";
          try (java.io.OutputStream out = getContentResolver().openOutputStream(uri)) {
            if (out == null) throw new IllegalStateException("DOCUMENT_OUTPUT_STREAM_NULL");
            out.write(bytes);
            out.flush();
          } catch (Exception copyError) {
            try { getContentResolver().delete(uri, null, null); } catch (Exception ignored) {}
            throw copyError;
          }
          ContentValues published = new ContentValues();
          published.put(MediaStore.Downloads.IS_PENDING, 0);
          getContentResolver().update(uri, published, null, null);
          notifyFileDownload(notificationTitle, safeName, uri, mimeType);
          return uri.toString();
        }
        File dir = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS), ALBUM_NAME);
        if (!dir.exists() && !dir.mkdirs()) return "";
        File destination = new File(dir, safeName);
        try (FileOutputStream out = new FileOutputStream(destination)) {
          out.write(bytes);
          out.flush();
        }
        Intent scan = new Intent(Intent.ACTION_MEDIA_SCANNER_SCAN_FILE);
        scan.setData(Uri.fromFile(destination));
        sendBroadcast(scan);
        notifyFileDownload(notificationTitle, safeName, Uri.fromFile(destination), mimeType);
        return destination.getAbsolutePath();
      } catch (Exception e) {
        android.util.Log.e("FieldTraceDownload", "Save document failed", e);
        return "";
      }
    }

    private void notifyFileDownload(String title, String fileName, Uri uri, String mimeType) {
      try {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != android.content.pm.PackageManager.PERMISSION_GRANTED) {
          requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 9101);
          return;
        }
        final String channelId = "fieldtrace_downloads";
        NotificationManager manager = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (manager == null) return;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
          NotificationChannel channel = new NotificationChannel(channelId, "Descargas de Field Trace", NotificationManager.IMPORTANCE_DEFAULT);
          channel.setDescription("Notificaciones de archivos descargados desde Field Trace");
          manager.createNotificationChannel(channel);
        }
        Intent openIntent = new Intent(Intent.ACTION_VIEW);
        openIntent.setDataAndType(uri, mimeType);
        openIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
        PendingIntent pendingIntent = PendingIntent.getActivity(
            MainActivity.this, (int) System.currentTimeMillis(), openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        Notification.Builder builder = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
            ? new Notification.Builder(MainActivity.this, channelId)
            : new Notification.Builder(MainActivity.this);
        builder.setSmallIcon(android.R.drawable.stat_sys_download_done)
            .setContentTitle(title)
            .setContentText(fileName)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent);
        manager.notify((int) (System.currentTimeMillis() & 0x7fffffff), builder.build());
      } catch (Exception e) {
        android.util.Log.e("FieldTraceDownload", "Notification failed", e);
      }
    }

    @JavascriptInterface
    public String saveVideoToGallery(String videoPath, String fileName) {
      if (videoPath == null || videoPath.trim().isEmpty()) return "";
      File source = resolveVideoFile(videoPath.trim());
      if (source == null || !source.isFile() || source.length() == 0) return "";
      String safeName = fileName == null || fileName.trim().isEmpty() ? "FT_video.mp4" : fileName.trim();
      if (!safeName.toLowerCase(Locale.US).endsWith(".mp4")) safeName += ".mp4";
      try {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
          ContentValues values = new ContentValues();
          values.put(MediaStore.Video.Media.DISPLAY_NAME, safeName);
          values.put(MediaStore.Video.Media.MIME_TYPE, "video/mp4");
          values.put(MediaStore.Video.Media.RELATIVE_PATH, Environment.DIRECTORY_DCIM + "/" + ALBUM_NAME + "/");
          values.put(MediaStore.Video.Media.IS_PENDING, 1);
          Uri uri = getContentResolver().insert(MediaStore.Video.Media.EXTERNAL_CONTENT_URI, values);
          if (uri == null) return "";
          try (FileInputStream in = new FileInputStream(source); java.io.OutputStream out = getContentResolver().openOutputStream(uri)) {
            if (out == null) throw new IllegalStateException("VIDEO_OUTPUT_STREAM_NULL");
            byte[] buffer = new byte[1024 * 1024]; int read;
            while ((read = in.read(buffer)) != -1) out.write(buffer, 0, read);
            out.flush();
          } catch (Exception copyError) {
            try { getContentResolver().delete(uri, null, null); } catch (Exception ignored) {}
            throw copyError;
          }
          ContentValues published = new ContentValues(); published.put(MediaStore.Video.Media.IS_PENDING, 0);
          getContentResolver().update(uri, published, null, null);
          return uri.toString();
        }
        File dir = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DCIM), ALBUM_NAME);
        if (!dir.exists() && !dir.mkdirs()) return "";
        File destination = new File(dir, safeName);
        try (FileInputStream in = new FileInputStream(source); FileOutputStream out = new FileOutputStream(destination)) {
          byte[] buffer = new byte[1024 * 1024]; int read;
          while ((read = in.read(buffer)) != -1) out.write(buffer, 0, read);
        }
        Intent scan = new Intent(Intent.ACTION_MEDIA_SCANNER_SCAN_FILE); scan.setData(Uri.fromFile(destination)); sendBroadcast(scan);
        return destination.getAbsolutePath();
      } catch (Exception e) { android.util.Log.e("FieldTraceVideo", "Save video failed", e); return ""; }
    }

  }

  @UnstableApi
  private static final class VideoMetadataOverlay extends CanvasOverlay {
    private final JSONObject config;
    private final Bitmap logo;
    private final long startEpochMs;
    VideoMetadataOverlay(JSONObject config) {
      super(true); this.config = config == null ? new JSONObject() : config;
      startEpochMs = this.config.optLong("capturedAtMs", System.currentTimeMillis());
      Bitmap decoded = null; String data = this.config.optString("logoImage", "");
      try { int comma = data.indexOf(','); if (data.startsWith("data:image") && comma > 0) { byte[] b = Base64.decode(data.substring(comma + 1), Base64.DEFAULT); decoded = BitmapFactory.decodeByteArray(b, 0, b.length); } } catch (Exception ignored) {}
      logo = decoded;
    }
    @Override public void configure(androidx.media3.common.util.Size size) { super.configure(size); }
    @Override public void onDraw(Canvas canvas, long presentationTimeUs) {
      canvas.drawColor(Color.TRANSPARENT, android.graphics.PorterDuff.Mode.CLEAR);
      float margin = canvas.getWidth() * .04f, fontSize = Math.max(24f, canvas.getWidth() / 40f);
      String scale = config.optString("fontSizeScale", "medium");
      if ("small".equals(scale)) fontSize *= .7f; else if ("large".equals(scale)) fontSize *= 1.5f;
      if (config.has("fontSizeValue") && !config.isNull("fontSizeValue")) fontSize = (float)(config.optDouble("fontSizeValue", 0) / 100d * (canvas.getWidth() / 10f));
      Paint p = new Paint(Paint.ANTI_ALIAS_FLAG | Paint.SUBPIXEL_TEXT_FLAG); p.setTypeface(Typeface.create("monospace", Typeface.BOLD)); p.setTextSize(fontSize);
      p.setColor(parseColor(config.optString("overlayColor", "#FFFFFF"), Color.WHITE)); p.setShadowLayer(12f,3f,3f,0xE6000000);
      java.util.ArrayList<String> raw = new java.util.ArrayList<>(); String project=config.optString("projectName", "");
      if (!project.isEmpty()) raw.add(project.toUpperCase(Locale.ROOT));
      if (config.optBoolean("showDateTime", false)) raw.add(formatDateTime(startEpochMs + presentationTimeUs / 1000L));
      if (config.optBoolean("showGps", false)) raw.add(config.optString("gpsLabel", "SIN GPS"));
      if (config.optBoolean("showLocation", false)) { String loc=config.optString("ubicacion", ""); if (!loc.isEmpty() && !"Buscando...".equals(loc)) raw.add(loc.toUpperCase(Locale.ROOT)); }
      if (config.optBoolean("showTech", false)) raw.add(config.optString("tech", "N/A").toUpperCase(Locale.ROOT));
      JSONArray fields=config.optJSONArray("customFields"); if(fields!=null) for(int i=0;i<fields.length();i++){ JSONObject cf=fields.optJSONObject(i); if(cf!=null&&cf.optBoolean("active",true)&&cf.optBoolean("showInPhoto",false)){String n=cf.optString("name","");String v=cf.optString("value","");if(!n.isEmpty())raw.add((v.isEmpty()?n:n+": "+v).toUpperCase(Locale.ROOT));}}
      String pos=config.optString("overlayPosition","top-left"), logoPos=config.optString("logoPosition","top-left");
      float logoW=(float)config.optDouble("logoSize",20)/100f*canvas.getWidth(); boolean same=logo!=null&&pos.equals(logoPos); float max=canvas.getWidth()-2*margin-(same?logoW+margin:0);
      java.util.ArrayList<String> lines=new java.util.ArrayList<>(); for(String line:raw)wrap(line,p,max,lines);
      float lh=fontSize*1.4f,total=lines.size()*lh,x=margin,y=margin; boolean right=pos.endsWith("right"),bottom=pos.startsWith("bottom"); if(right){p.setTextAlign(Paint.Align.RIGHT);x=canvas.getWidth()-margin;}else p.setTextAlign(Paint.Align.LEFT);if(bottom)y=canvas.getHeight()-total-margin;
      for(int i=0;i<lines.size();i++)canvas.drawText(lines.get(i),x,y+i*lh+fontSize,p);p.clearShadowLayer();
      if(logo!=null&&!logo.isRecycled()){float ratio=(float)logo.getHeight()/Math.max(1,logo.getWidth()),w=logoW,h=w*ratio,lx=margin,ly=margin;if(logoPos.endsWith("right"))lx=canvas.getWidth()-w-margin;if(logoPos.startsWith("bottom"))ly=canvas.getHeight()-h-margin;Paint lp=new Paint(Paint.ANTI_ALIAS_FLAG|Paint.FILTER_BITMAP_FLAG);lp.setAlpha(Math.max(0,Math.min(255,Math.round((float)config.optDouble("logoOpacity",80)/100f*255f))));canvas.drawBitmap(logo,null,new RectF(lx,ly,lx+w,ly+h),lp);}
    }
    private static void wrap(String value,Paint p,float max,java.util.List<String> out){String cur="";int count=0;for(String word:value.split(" ")){String t=cur.isEmpty()?word:cur+" "+word;if(!cur.isEmpty()&&p.measureText(t)>max){out.add(cur);cur=word;if(++count>=4){out.set(out.size()-1,out.get(out.size()-1)+"...");cur="";break;}}else cur=t;}if(!cur.isEmpty())out.add(cur);}
    private static int parseColor(String value,int fallback){try{return Color.parseColor(value);}catch(Exception e){return fallback;}}
    private String formatDateTime(long ms){boolean f2="format2".equals(config.optString("dateTimeFormat","format1"));return new SimpleDateFormat(f2?"d/M/yyyy h:mm a":"dd MMM yyyy h:mm:ss a",new Locale("es","ES")).format(new Date(ms));}
  }

}
