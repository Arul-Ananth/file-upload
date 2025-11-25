package org.example.backend.web;

import org.example.backend.file.model.FileResource;
import org.example.backend.file.service.FileStorageService;
import org.example.backend.web.dto.FileDto;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.nio.charset.StandardCharsets;
import java.util.List;

@RestController
@RequestMapping("/files")
@Validated
@CrossOrigin(origins = "*")
public class FileController {

    private final FileStorageService service;

    public FileController(FileStorageService service) {
        this.service = service;
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public FileDto upload(@RequestPart("file") MultipartFile file) {
        FileResource saved = service.store(file);
        return FileDto.from(saved);
    }

    @GetMapping
    public List<FileDto> list() {
        return service.listAll().stream().map(FileDto::from).toList();
    }

    @GetMapping("/{id}")
    public FileDto metadata(@PathVariable Long id) {
        return FileDto.from(service.getById(id));
    }

    @GetMapping("/{id}/download")
    public ResponseEntity<?> download(@PathVariable Long id) {
        var res = service.loadForDownload(id);
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.parseMediaType(res.contentType()));
        headers.setContentLength(res.size());
        ContentDisposition cd = ContentDisposition.attachment()
                .filename(res.filename(), StandardCharsets.UTF_8)
                .build();
        headers.setContentDisposition(cd);
        return new ResponseEntity<>(res.resource(), headers, HttpStatus.OK);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        service.delete(id);
    }
}
