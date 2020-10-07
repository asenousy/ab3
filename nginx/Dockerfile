FROM nginx:1.14
COPY ./default.conf /etc/nginx/conf.d/default.conf
COPY index.html /var/www/html/index.html
RUN chown -R nginx:nginx /var/www/html
