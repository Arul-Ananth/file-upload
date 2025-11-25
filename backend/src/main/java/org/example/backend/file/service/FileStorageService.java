package org.example.backend.file.service;

import org.example.backend.config.StorageProperties;
import org.example.backend.file.model.FileResource;
import org.example.backend.file.repo.FileResourceRepository;
import org.example.backend.web.error.NotFoundException;
import org.example.backend.web.error.StorageException;
import org.springframework.core.io.InputStreamResource;
import org.springframework.core.io.Resource;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.*;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;

@Service
public class FileStorageService {

    private final FileResourceRepository repository;
    private final Path baseDir;

    public FileStorageService(FileResourceRepository repository, StorageProperties props) {
        this.repository = repository;
        this.baseDir = Paths.get(props.getBaseDir()).toAbsolutePath().normalize();
        init();
    }

    private void init() {
        try {
            Files.createDirectories(baseDir);
        } catch (IOException e) {
            throw new StorageException("Could not create storage directory: " + baseDir, e);
        }
    }

    @Transactional
    public FileResource store(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new StorageException("Empty file");
        }
        String original = StringUtils.cleanPath(file.getOriginalFilename() != null ? file.getOriginalFilename() : "file");
        String contentType = file.getContentType() != null ? file.getContentType() : MediaType.APPLICATION_OCTET_STREAM_VALUE;

        String storageName = UUID.randomUUID().toString();
        Path target = baseDir.resolve(storageName);

        String checksum;
        long size;
        try (InputStream in = file.getInputStream()) {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            // copy while hashing
            size = Files.copy(in, target, StandardCopyOption.REPLACE_EXISTING);
            try (InputStream in2 = Files.newInputStream(target, StandardOpenOption.READ)) {
                in2.transferTo(new java.io.OutputStream() {
                    @Override public void write(int b) { md.update((byte) b); }
                    @Override public void write(byte[] b, int off, int len) { md.update(b, off, len); }
                });
            }
            checksum = HexFormat.of().formatHex(md.digest());
        } catch (IOException | NoSuchAlgorithmException e) {
            try { Files.deleteIfExists(target); } catch (IOException ignored) {}
            throw new StorageException("Failed to store file", e);
        }

        FileResource entity = new FileResource();
        entity.setOriginalFilename(original);
        entity.setContentType(contentType);
        entity.setStorageFilename(storageName);
        entity.setSize(size);
        entity.setChecksum(checksum);

        return repository.save(entity);
    }

    @Transactional(readOnly = true)
    public List<FileResource> listAll() {
        return repository.findAll();
    }

    @Transactional(readOnly = true)
    public FileResource getById(Long id) {
        return repository.findById(id).orElseThrow(() -> new NotFoundException("File not found: " + id));
    }

    @Transactional
    public ResourceWithName loadForDownload(Long id) {
        FileResource fr = getById(id);
        Path path = baseDir.resolve(fr.getStorageFilename());
        if (!Files.exists(path)) {
            throw new NotFoundException("Stored file missing on disk");
        }
        try {
            Resource resource = new InputStreamResource(Files.newInputStream(path, StandardOpenOption.READ));
            fr.setDownloadCount(fr.getDownloadCount() + 1);
            repository.save(fr);
            return new ResourceWithName(resource, fr.getOriginalFilename(), fr.getContentType(), fr.getSize());
        } catch (IOException e) {
            throw new StorageException("Failed to read file", e);
        }
    }

    @Transactional
    public void delete(Long id) {
        FileResource fr = getById(id);
        Path path = baseDir.resolve(fr.getStorageFilename());
        try {
            Files.deleteIfExists(path);
        } catch (IOException e) {
            throw new StorageException("Failed to delete file from disk", e);
        }
        repository.delete(fr);
    }

    public record ResourceWithName(Resource resource, String filename, String contentType, long size) { }
}
