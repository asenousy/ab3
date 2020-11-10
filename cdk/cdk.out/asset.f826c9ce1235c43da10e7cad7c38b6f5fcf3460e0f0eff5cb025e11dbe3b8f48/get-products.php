<?php
    try {
      // header("Content-Type:application/json");

      $secrets = getenv('SECRETS');
      $configs = json_decode($secrets);
      $host = $configs['host'];
      echo $host;
      // $username = $configs['DB_USER'];
      // $password = $configs['DB_PW'];
      // $dbName = $configs['DB_NAME'];

      // $conn = new PDO("mysql:host=$host;dbname=$dbName", $username, $password);
      // $conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
      
      // $stmt = $conn->prepare("SELECT * FROM products");
      // $stmt->execute();
      // $stmt->setFetchMode(PDO::FETCH_ASSOC);
      // $result = $stmt->fetchAll();
      
      // $json_response = json_encode($result);
      // echo $json_response;
      
    } catch(PDOException $e) {
      echo "Connection failed: " . $e->getMessage();
    }
    
?>